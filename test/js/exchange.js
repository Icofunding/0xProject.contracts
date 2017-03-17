const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./tokens/DummyTokenA.sol');
const DummyTokenB = artifacts.require('./tokens/DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./tokens/DummyProtocolToken.sol');

const assert = require('assert');
const util = require('../../util/index.js')(web3);

const { add, sub, mul, div, cmp, toSmallestUnits } = util.BNutil;

contract('Exchange', accounts => {
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
  let getDmyBalances;

  const orderFactory = util.createOrderFactory({
    exchange: Exchange.address,
    maker,
    feeRecipient,
    tokenM: DummyTokenA.address,
    tokenT: DummyTokenB.address,
    valueM: toSmallestUnits(100),
    valueT: toSmallestUnits(200),
    feeM: toSmallestUnits(1),
    feeT: toSmallestUnits(1),
  });

  before(done => {
    Promise.all([
      Exchange.deployed(),
      DummyTokenA.deployed(),
      DummyTokenB.deployed(),
      DummyProtocolToken.deployed(),
    ]).then(instances => {
      [exchange, dmyA, dmyB, dmyPT] = instances;
      exUtil = util.exchangeUtil(exchange);
      getDmyBalances = util.getBalancesFactory([dmyA, dmyB, dmyPT], [maker, taker, feeRecipient]);
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
        dmyPT.setBalance(INIT_BAL, { from: taker }),
      ]).then(() => done()).catch(e => done(e));
    });
  });

  describe('utility functions', () => {
    it('transferFrom should be private', done => {
      assert(exchange.transferFrom === undefined);
      done();
    });
  });

  describe('fill', () => {
    beforeEach(done => {
      getDmyBalances().then(newBalances => {
        balances = newBalances;
        util.createOrder(orderFactory()).then(newOrder => {
          order = newOrder;
          done();
        });
      });
    });

    it('should transfer the correct amounts when valueM === valueT', done => {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(100), valueT: toSmallestUnits(100) })).then(newOrder => {
        order = newOrder;
        const fillValueM = div(order.valueM, 2);
        exUtil.fill(order, { fillValueM, from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
            const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
            const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
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

    it('should transfer the correct amounts when valueM > valueT', done => {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(200), valueT: toSmallestUnits(100) })).then(newOrder => {
        order = newOrder;
        const fillValueM = div(order.valueM, 2);
        exUtil.fill(order, { fillValueM, from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
            const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
            const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
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

    it('should transfer the correct amounts when valueM < valueT', done => {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) })).then(newOrder => {
        order = newOrder;
        const fillValueM = div(order.valueM, 2);
        exUtil.fill(order, { fillValueM, from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
            const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
            const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
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

    it('should transfer the correct amounts when taker is specified and order is claimed by taker', done => {
      util.createOrder(orderFactory({ taker, valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) })).then(newOrder => {
        order = newOrder;
        const fillValueM = div(order.valueM, 2);
        exUtil.fill(order, { fillValueM, from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
            const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
            const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
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

    it('should throw when taker is specified and order is claimed by other', done => {
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

    it('should throw if an order is expired', done => {
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

    it('should throw if fillValueM > valueM', done => {
      exUtil.fill(order, { fillValueM: add(order.valueM, 1), from: taker }).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should throw if fillValueM > remaining valueM', done => {
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

    it('should throw if signature is invalid', done => {
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

    it('should throw if a transfer fails', done => {
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

    it('should log 2 events', done => {
      exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(res => {
        // console.log('gasgUsed:', res.receipt.gasUsed);
        assert(res.logs.length === 2);
        done();
      }).catch(e => {
        assert(!e);
        done();
      });
    });
  });

  describe('batchFill', () => {
    let orders;
    beforeEach(done => {
      Promise.all([
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
      ]).then(newOrders => {
        orders = newOrders;
        getDmyBalances().then(newBalances => {
          balances = newBalances;
          done();
        });
      });
    });

    it('should transfer the correct amounts', done => {
      const fillValuesM = [];
      const tokenM = dmyA.address;
      const tokenT = dmyB.address;
      orders.forEach(o => {
        const fillValueM = div(o.valueM, 2);
        const fillValueT = div(mul(fillValueM, o.valueT), o.valueM);
        const feeValueM = div(mul(o.feeM, fillValueM), o.valueM);
        const feeValueT = div(mul(o.feeT, fillValueM), o.valueM);
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
      });
    });

    it('should allow tokens acquired in trade to be used in later trade', done => {
      dmyPT.setBalance(0, { from: taker }).then(() => {
        balances[taker][dmyPT.address] = 0;
        util.createOrder(orderFactory({ tokenM: dmyPT.address, feeT: 0 })).then(newOrder => {
          orders[0] = newOrder;
          const rest = orders.slice(1);
          const fillValuesM = [0];
          rest.forEach(o => {
            fillValuesM[0] = add(fillValuesM[0], o.feeT);
            fillValuesM.push(o.valueM);
          });
          orders.forEach((o, i) => {
            const fillValueM = fillValuesM[i];
            const fillValueT = div(mul(fillValueM, o.valueT), o.valueM);
            const feeValueM = div(mul(o.feeM, fillValueM), o.valueM);
            const feeValueT = div(mul(o.feeT, fillValueM), o.valueM);
            balances[maker][o.tokenM] = sub(balances[maker][o.tokenM], fillValueM);
            balances[maker][o.tokenT] = add(balances[maker][o.tokenT], fillValueT);
            balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], feeValueM);
            balances[taker][o.tokenM] = add(balances[taker][o.tokenM], fillValueM);
            balances[taker][o.tokenT] = sub(balances[taker][o.tokenT], fillValueT);
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
          });
        });
      });
    });

    it('should cost less gas per order to execute batchFill', done => {
      Promise.all(orders.map(o => exUtil.fill(o, { fillValueM: div(o.valueM, 2), from: taker }))).then(res => {
        let totalGas = 0;
        res.forEach(tx => {
          totalGas = add(totalGas, tx.receipt.gasUsed);
        });
        exUtil.batchFill(orders, { fillValuesM: orders.map(o => div(o.valueM, 2)), from: taker }).then(innerRes => {
          // console.log('fill:', totalGas);
          // console.log('batchFill:', innerRes.receipt.gasUsed);
          assert(cmp(innerRes.receipt.gasUsed, totalGas) === -1);
          done();
        }).catch(e => {
          assert(!e);
          done();
        });
      });
    });

    it('should log 2 events per order', done => {
      exUtil.batchFill(orders, { fillValuesM: orders.map(o => div(o.valueM, 2)), from: taker }).then(res => {
        assert(res.logs.length === orders.length * 2);
        done();
      }).catch(e => {
        assert(!e);
        done();
      });
    });
  });

  describe('cancel', () => {
    beforeEach(done => {
      util.createOrder(orderFactory()).then(newOrder => {
        order = newOrder;
        done();
      });
    });

    it('should throw if not sent by maker', done => {
      exUtil.cancel(order, { cancelValueM: order.valueM, from: taker }).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should throw if cancelValueM === 0', done => {
      exUtil.cancel(order, { cancelValueM: 0, from: maker }).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should be able to cancel a full order', done => {
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

    it('should be able to cancel part of an order', done => {
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

    it('should log 1 event', done => {
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
