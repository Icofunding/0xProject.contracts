const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const DummyTokenB = artifacts.require('./DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');

const util = require('../../util/index.js')(web3);
const { add, sub, mul, div, cmp, toSmallestUnits } = util.BNutil;
const assert = require('assert');

contract('Exchange', function(accounts) {
  const maker = accounts[0];
  const taker = accounts[1] || accounts[accounts.length - 1];
  const feeRecipient = accounts[2] || accounts[accounts.length - 1];
  const INIT_BAL = toSmallestUnits(10000);
  const INIT_ALLOW = toSmallestUnits(10000);

  let dmyA;
  let dmyB;
  let dmyPT;
  let exchange;

  let order;
  let balances;

  let exUtil;

  const orderFactory = params => {
    let defaultParams = {
      exchange: Exchange.address,
      maker,
      taker: '0x0',
      feeRecipient,
      tokenM: DummyTokenA.address,
      tokenT: DummyTokenB.address,
      valueM: toSmallestUnits(100),
      valueT: toSmallestUnits(200),
      feeM: toSmallestUnits(1),
      feeT: toSmallestUnits(1),
      expiration: Math.floor((Date.now() + Math.random() * 100000) / 1000)
    };
    return Object.assign({}, defaultParams, params);
  };

  const getDmyBalances = () => {
    return new Promise((resolve, reject) => {
      Promise.all([
        dmyA.balanceOf.call(maker),
        dmyA.balanceOf.call(taker),
        dmyA.balanceOf.call(feeRecipient),
        dmyB.balanceOf.call(maker),
        dmyB.balanceOf.call(taker),
        dmyB.balanceOf.call(feeRecipient),
        dmyPT.balanceOf.call(maker),
        dmyPT.balanceOf.call(taker),
        dmyPT.balanceOf.call(feeRecipient)
      ]).then(res => {
        let newBalances = {
          [maker]: {},
          [taker]: {},
          [feeRecipient]: {}
        };
        res = res.map(balance => balance.toString());
        [
          newBalances[maker][dmyA.address],
          newBalances[taker][dmyA.address],
          newBalances[feeRecipient][dmyA.address],
          newBalances[maker][dmyB.address],
          newBalances[taker][dmyB.address],
          newBalances[feeRecipient][dmyB.address],
          newBalances[maker][dmyPT.address],
          newBalances[taker][dmyPT.address],
          newBalances[feeRecipient][dmyPT.address]
        ] = res;
        resolve(newBalances);
      });
    });
  };

  before(function(done) {
    Promise.all([
      Exchange.deployed(),
      DummyTokenA.deployed(),
      DummyTokenB.deployed(),
      DummyProtocolToken.deployed()
    ]).then(instances => {
      [exchange, dmyA, dmyB, dmyPT] = instances;
      exUtil = util.exchangeUtil(exchange);
      return Promise.all([
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: maker }),
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: taker }),
        dmyA.setBalance(INIT_BAL, { from: maker }),
        dmyA.setBalance(INIT_BAL, { from: taker }),
        dmyB.approve(Proxy.address, INIT_ALLOW, { from: maker }),
        dmyB.approve(Proxy.address, INIT_ALLOW, { from: taker }),
        dmyB.setBalance(INIT_BAL, { from: maker }),
        dmyB.setBalance(INIT_BAL, { from: taker }),
        dmyPT.approve(Proxy.address, INIT_ALLOW, { from: maker }),
        dmyPT.approve(Proxy.address, INIT_ALLOW, { from: taker }),
        dmyPT.setBalance(INIT_BAL, { from: maker }),
        dmyPT.setBalance(INIT_BAL, { from: taker })
      ]).then(() => done()).catch(e => console.log(e))
    });
  });

  describe('utility functions', function() {
    beforeEach(function(done) {
      util.createOrder(orderFactory()).then(newOrder => {
        order = newOrder;
        done();
      });
    });

    it('getOrderHash should output the correct orderHash', function(done) {
      exUtil.getOrderHash(order).then(orderHash => {
        assert(order.orderHash === orderHash);
        done();
      });
    });

    it('getMsgHash should output the correct msgHash', function(done) {
      exUtil.getMsgHash(order).then(msgHash => {
        assert(util.getMsgHash(order, { hex: true }) === msgHash);
        done();
      });
    });

    it('validSignature should return true with a valid signature', function(done) {
      exUtil.validSignature(order).then(success => {
        assert(util.validSignature(order));
        assert(success);
        done();
      });
    });

    it('validSignature should return false with an invalid signature', function(done) {
      order.r = util.sha3('invalidR');
      order.s = util.sha3('invalidS');
      exUtil.validSignature(order).then(success => {
        assert(!util.validSignature(order));
        assert(!success);
        done();
      });
    });

    it('validSignature should return false with an invalid message hash', function(done) {
      order.orderHash = util.sha3('invalid');
      exUtil.validSignature(order).then(success => {
        assert(!success);
        done();
      });
    });

    it('transferFrom should be private', function(done) {
      assert(exchange.transferFrom === undefined);
      done();
    });
    
    it('getFillValueT should throw if there is a rounding error', function(done) {
      done();
    });
  });

  describe('fill', function() {
    beforeEach(function(done) {
      getDmyBalances().then(newBalances => {
        balances = newBalances;
        util.createOrder(orderFactory()).then(newOrder => {
          order = newOrder;
          done();
        });
      });
    });

    it('should transfer the correct amounts when valueM === valueT', function(done) {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(100), valueT: toSmallestUnits(100) })).then(newOrder => {
        order = newOrder;
        let fillValueM = div(order.valueM, 2);
        exUtil.fill(order, { fillValueM, from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            let fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
            let feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
            let feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
            assert(newBalances[maker][order.tokenM] === sub(balances[maker][order.tokenM], fillValueM));
            assert(newBalances[maker][order.tokenT] === add(balances[maker][order.tokenT], fillValueT));
            assert(newBalances[maker][dmyPT.address] === sub(balances[maker][dmyPT.address], feeValueM));
            assert(newBalances[taker][order.tokenT] === sub(balances[taker][order.tokenT], fillValueT));
            assert(newBalances[taker][order.tokenM] === add(balances[taker][order.tokenM], fillValueM));
            assert(newBalances[taker][dmyPT.address] === sub(balances[taker][dmyPT.address], feeValueT));
            assert(newBalances[feeRecipient][dmyPT.address] === add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
            done();
          });
        }).catch(e => {
          assert(!e);
          done();
        });
      });
    });

    it('should transfer the correct amounts when valueM > valueT', function(done) {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(200), valueT: toSmallestUnits(100) })).then(newOrder => {
        order = newOrder;
        let fillValueM = div(order.valueM, 2);
        exUtil.fill(order, { fillValueM, from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            let fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
            let feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
            let feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
            assert(newBalances[maker][order.tokenM] === sub(balances[maker][order.tokenM], fillValueM));
            assert(newBalances[maker][order.tokenT] === add(balances[maker][order.tokenT], fillValueT));
            assert(newBalances[maker][dmyPT.address] === sub(balances[maker][dmyPT.address], feeValueM));
            assert(newBalances[taker][order.tokenT] === sub(balances[taker][order.tokenT], fillValueT));
            assert(newBalances[taker][order.tokenM] === add(balances[taker][order.tokenM], fillValueM));
            assert(newBalances[taker][dmyPT.address] === sub(balances[taker][dmyPT.address], feeValueT));
            assert(newBalances[feeRecipient][dmyPT.address] === add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
            done();
          });
        }).catch(e => {
          assert(!e);
          done();
        });
      });
    });

    it('should transfer the correct amounts when valueM < valueT', function(done) {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) })).then(newOrder => {
        order = newOrder;
        let fillValueM = div(order.valueM, 2);
        exUtil.fill(order, { fillValueM, from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            let fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
            let feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
            let feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
            assert(newBalances[maker][order.tokenM] === sub(balances[maker][order.tokenM], fillValueM));
            assert(newBalances[maker][order.tokenT] === add(balances[maker][order.tokenT], fillValueT));
            assert(newBalances[maker][dmyPT.address] === sub(balances[maker][dmyPT.address], feeValueM));
            assert(newBalances[taker][order.tokenT] === sub(balances[taker][order.tokenT], fillValueT));
            assert(newBalances[taker][order.tokenM] === add(balances[taker][order.tokenM], fillValueM));
            assert(newBalances[taker][dmyPT.address] === sub(balances[taker][dmyPT.address], feeValueT));
            assert(newBalances[feeRecipient][dmyPT.address] === add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
            done();
          });
        }).catch(e => {
          assert(!e);
          done();
        });
      });
    });

    it('should transfer the correct amounts when taker is specified and order is claimed by taker', function(done) {
      util.createOrder(orderFactory({ taker, valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) })).then(newOrder => {
        order = newOrder;
        let fillValueM = div(order.valueM, 2);
        exUtil.fill(order, { fillValueM, from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            let fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
            let feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
            let feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
            assert(newBalances[maker][order.tokenM] === sub(balances[maker][order.tokenM], fillValueM));
            assert(newBalances[maker][order.tokenT] === add(balances[maker][order.tokenT], fillValueT));
            assert(newBalances[maker][dmyPT.address] === sub(balances[maker][dmyPT.address], feeValueM));
            assert(newBalances[taker][order.tokenT] === sub(balances[taker][order.tokenT], fillValueT));
            assert(newBalances[taker][order.tokenM] === add(balances[taker][order.tokenM], fillValueM));
            assert(newBalances[taker][dmyPT.address] === sub(balances[taker][dmyPT.address], feeValueT));
            assert(newBalances[feeRecipient][dmyPT.address] === add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
            done();
          });
        }).catch(e => {
          assert(!e);
          done();
        });
      });
    });

    it('should throw when taker is specified and order is claimed by other', function(done) {
      util.createOrder(orderFactory({ taker: feeRecipient, valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) })).then(newOrder => {
        order = newOrder;
        exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(res => {
          assert(!res);
          done();
        }).catch(e => {
          assert(e);
          done();
        });
      });
    });

    it('should throw if an order is expired', function(done) {
      util.createOrder(orderFactory({ expiration: Math.floor((Date.now() - 10000) / 1000) })).then(newOrder => {
        order = newOrder;
        exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(res => {
          assert(!res);
          done();
        }).catch(e => {
          assert(e);
          done();
        });
      });
    });

    it('should throw if fillValueM > valueM', function(done) {
      exUtil.fill(order, { fillValueM: add(order.valueM, 1), from: taker }).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should throw if fillValueM > remaining valueM', function(done) {
      let fillValueM = div(order.valueM, 2);
      exUtil.fill(order, { fillValueM, from: taker }).then(() => {
        fillValueM = add(fillValueM, 1);
        exUtil.fill(order, { fillValueM, from: taker }).then(res => {
          assert(!res);
          done();
        }).catch(e => {
          assert(e);
          done();
        });
      });
    });

    it('should throw if signature is invalid', function(done){
      util.createOrder(orderFactory({ valueM: toSmallestUnits(10) })).then(newOrder => {
        order = newOrder;
        order.r = util.sha3('invalidR');
        order.s = util.sha3('invalidS');
        exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(res => {
          assert(!res);
          done();
        }).catch(e => {
          assert(e);
          done();
        });
      });
    });

    it('should throw if a transfer fails', function(done){
      util.createOrder(orderFactory({ valueM: toSmallestUnits(100000) })).then(newOrder => {
        order = newOrder;
        exUtil.fill(order, { fillValueM: order.valueM, from: taker }).then(res => {
          assert(!res);
          done();
        }).catch(e => {
          assert(e);
          done();
        });
      });
    });

    it('should log 2 events', function(done) {
      exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(res => {
        assert(res.logs.length === 2);
        done();
      }).catch(e => {
        assert(!e);
        done();
      });
    });

  });

  describe('batchFill', function() {
    let orders;
    beforeEach(function(done) {
      Promise.all([
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory())
      ]).then(newOrders => {
        orders = newOrders;
        getDmyBalances().then(newBalances => {
          balances = newBalances;
          done();
        });
      });
    });

    it('should transfer the correct amounts', function(done) {
      let fillValuesM = [];
      let tokenM = dmyA.address;
      let tokenT = dmyB.address;
      orders.forEach(order => {
        let fillValueM = div(order.valueM, 2);
        let fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
        let feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
        let feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
        fillValuesM.push(fillValueM);
        balances[maker][tokenM] = sub(balances[maker][tokenM], fillValueM);
        balances[maker][tokenT] = add(balances[maker][tokenT], fillValueT);
        balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], feeValueM);
        balances[taker][tokenM] = add(balances[taker][tokenM], fillValueM);
        balances[taker][tokenT] = sub(balances[taker][tokenT], fillValueT);
        balances[taker][dmyPT.address] = sub(balances[taker][dmyPT.address], feeValueT);
        balances[feeRecipient][dmyPT.address] = add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT));
      });
      exUtil.batchFill(orders, { fillValuesM, from: taker }).then(() => {
        getDmyBalances().then(newBalances => {
          assert(newBalances[maker][tokenM] === balances[maker][tokenM]);
          assert(newBalances[maker][tokenT] === balances[maker][tokenT]);
          assert(newBalances[maker][dmyPT.address] === balances[maker][dmyPT.address]);
          assert(newBalances[taker][tokenT] === balances[taker][tokenT]);
          assert(newBalances[taker][tokenM] === balances[taker][tokenM]);
          assert(newBalances[taker][dmyPT.address] === balances[taker][dmyPT.address]);
          assert(newBalances[feeRecipient][dmyPT.address] === balances[feeRecipient][dmyPT.address]);
          done();
        });
      }).catch(e => {
        assert(!e);
        done();
      })
    });

    it('should allow tokens acquired in trade to be used in later trade', function(done) {
      dmyPT.setBalance(0, { from: taker }).then(() => {
        balances[taker][dmyPT.address] = 0;
        util.createOrder(orderFactory({ tokenM: dmyPT.address, feeT: 0 })).then(newOrder => {
          orders[0] = newOrder;
          let rest = orders.slice(1);
          let fillValuesM = [0];
          rest.forEach(order => {
            fillValuesM[0] = add(fillValuesM[0], order.feeT);
            fillValuesM.push(order.valueM);
          });
          orders.forEach((order, i) => {
            let fillValueM = fillValuesM[i];
            let fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
            let feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
            let feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
            balances[maker][order.tokenM] = sub(balances[maker][order.tokenM], fillValueM);
            balances[maker][order.tokenT] = add(balances[maker][order.tokenT], fillValueT);
            balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], feeValueM);
            balances[taker][order.tokenM] = add(balances[taker][order.tokenM], fillValueM);
            balances[taker][order.tokenT] = sub(balances[taker][order.tokenT], fillValueT);
            balances[taker][dmyPT.address] = sub(balances[taker][dmyPT.address], feeValueT);
            balances[feeRecipient][dmyPT.address] = add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT));
          });
          exUtil.batchFill(orders, { fillValuesM, from: taker }).then(() => {
            getDmyBalances().then(newBalances => {
              assert(newBalances[maker][dmyA.address] === balances[maker][dmyA.address]);
              assert(newBalances[maker][dmyB.address] === balances[maker][dmyB.address]);
              assert(newBalances[maker][dmyPT.address] === balances[maker][dmyPT.address]);
              assert(newBalances[taker][dmyB.address] === balances[taker][dmyB.address]);
              assert(newBalances[taker][dmyA.address] === balances[taker][dmyA.address]);
              assert(newBalances[taker][dmyPT.address] === balances[taker][dmyPT.address]);
              assert(newBalances[feeRecipient][dmyPT.address] === balances[feeRecipient][dmyPT.address]);
              dmyPT.setBalance(INIT_BAL, { from: taker }).then(() => {
                done();
              });
            });
          }).catch(e => {
            dmyPT.setBalance(INIT_BAL, { from: taker }).then(() => {
              assert(!e);
              done();
            });
          })
        });
      });
    });

    it('should cost less gas per order to execute batchFill', function(done) {
      Promise.all(orders.map(order => exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }))).then(res => {
        let totalGas = 0;
        res.forEach(tx => totalGas = add(totalGas, tx.receipt.gasUsed));
        exUtil.batchFill(orders, { fillValuesM: orders.map(order => div(order.valueM, 2)), from: taker }).then(res => {
          console.log('fill:', totalGas);
          console.log('batchFill:', res.receipt.gasUsed);
          assert(cmp(res.receipt.gasUsed, totalGas) === -1);
          done();
        }).catch(e => {
          //why does this error sometimes?
          assert(!e);
          done();
        });
      });
    });

    it('should log 2 events per order', function(done) {
      exUtil.batchFill(orders, { fillValuesM: orders.map(order => div(order.valueM, 2)), from: taker }).then(res => {
        assert(res.logs.length = orders.length * 2);
        done();
      }).catch(e => {
        assert(!e);
        done();
      })
    });
  });

  describe('cancel', function() {
    beforeEach(function(done) {
      util.createOrder(orderFactory()).then(newOrder => {
        order = newOrder;
        done();
      });
    });

    it('should throw if not sent by maker', function(done) {
      exUtil.cancel(order, { cancelValueM: order.valueM, from: taker }).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should throw if cancelValueM === 0', function(done) {
      exUtil.cancel(order, { cancelValueM: 0, from: maker }).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should be able to cancel a full order', function(done) {
      exUtil.cancel(order, { cancelValueM: order.valueM, from: maker }).then(() => {
        exUtil.fill(order, { fillValueM: 1, from: taker }).then(res => {
          assert(!res);
          done();
        }).catch(e => {
          assert(e);
          done();
        });
      }).catch(e => {
        assert(!e);
        done();
      });
    });

    it('should be able to cancel part of an order', function(done) {
      exUtil.cancel(order, { cancelValueM: div(order.valueM, 2), from: maker }).then(() => {
        exUtil.fill(order, { fillValueM: div(order.valueM, 4), from: taker }).then(() => {
          exUtil.fill(order, { fillValueM: add(div(order.valueM, 4), 1), from: taker }).then(res => {
            assert(!res);
            done();
          }).catch(e => {
            assert(e);
            done();
          });
        });
      }).catch(e => {
        assert(!e);
        done();
      });
    });

    it('should log 1 event', function(done) {
      exUtil.cancel(order, { cancelValueM: div(order.valueM, 2), from: maker }).then(res => {
        assert(res.logs.length === 1);
        done();
      }).catch(e => {
        assert(!e);
        done();
      });
    });
  });
});
