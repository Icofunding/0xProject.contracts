const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./tokens/DummyTokenA.sol');
const DummyTokenB = artifacts.require('./tokens/DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./tokens/DummyProtocolToken.sol');

const assert = require('assert');
const expect = require('chai').expect;
const util = require('../../util/index.js')(web3);

const { add, sub, mul, div, toSmallestUnits } = util.BNutil;

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

  describe('private functions', () => {
    it('should include transferViaProxy', done => {
      assert(exchange.transferViaProxy === undefined);
      done();
    });

    it('should include logFillEvents', done => {
      assert(exchange.logFillEvents === undefined);
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

    it('should fill remaining value if fillValueM > remaining valueM', done => {
      const fillValueM = div(order.valueM, 2);
      exUtil.fill(order, { fillValueM, from: taker }).then(() => {
        exUtil.fill(order, { fillValueM: order.valueM, from: taker }).then(res => {
          assert(res.logs[0].args.filledValueM.toString() === sub(order.valueM, fillValueM));
          getDmyBalances().then(newBalances => {
            assert(newBalances[maker][order.tokenM] === sub(balances[maker][order.tokenM], order.valueM));
            assert(newBalances[maker][order.tokenT] === add(balances[maker][order.tokenT], order.valueT));
            assert(newBalances[maker][dmyPT.address] === sub(balances[maker][dmyPT.address], order.feeM));
            assert(newBalances[taker][order.tokenT] === sub(balances[taker][order.tokenT], order.valueT));
            assert(newBalances[taker][order.tokenM] === add(balances[taker][order.tokenM], order.valueM));
            assert(newBalances[taker][dmyPT.address] === sub(balances[taker][dmyPT.address], order.feeT));
            assert(newBalances[feeRecipient][dmyPT.address] === add(balances[feeRecipient][dmyPT.address], add(order.feeM, order.feeT)));
            done();
          });
        }).catch(e => {
          assert(!e);
          done();
        });
      });
    });

    it('should log 2 events', done => {
      exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(res => {
        // console.log('gasUsed:', res.receipt.gasUsed);
        assert(res.logs.length === 2);
        done();
      }).catch(e => {
        assert(!e);
        done();
      });
    });

    it('should not change balances when taker is specified and order is claimed by other', done => {
      util.createOrder(orderFactory({ taker: feeRecipient, valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) })).then(newOrder => {
        order = newOrder;
        exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            expect(newBalances).to.deep.equal(balances);
            done();
          });
        });
      });
    });

    it('should not change balances with an invalid caller', done => {
      util.createOrder(orderFactory()).then(newOrder => {
        order = newOrder;
        exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker, caller: maker }).then(() => {
          getDmyBalances().then(newBalances => {
            expect(newBalances).to.deep.equal(balances);
            done();
          });
        });
      });
    });

    it('should not change balances if signature is invalid', done => {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(10) })).then(newOrder => {
        order = newOrder;
        order.r = util.sha3('invalidR');
        order.s = util.sha3('invalidS');
        exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            expect(newBalances).to.deep.equal(balances);
            done();
          });
        });
      });
    });

    it('should not change balances if a transfer fails', done => {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(100000) })).then(newOrder => {
        order = newOrder;
        exUtil.fill(order, { fillValueM: order.valueM, from: taker }).then(() => {
          // console.log(res.receipt.gasUsed);
          getDmyBalances().then(newBalances => {
            expect(newBalances).to.deep.equal(balances);
            done();
          });
        });
      });
    });

    it('should not change balances if an order is expired', done => {
      util.createOrder(orderFactory({ expiration: Math.floor((Date.now() - 10000) / 1000) })).then(newOrder => {
        order = newOrder;
        exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            expect(newBalances).to.deep.equal(balances);
            done();
          });
        });
      });
    });

    it('should not log events if an order is expired', done => {
      util.createOrder(orderFactory({ expiration: Math.floor((Date.now() - 10000) / 1000) })).then(newOrder => {
        order = newOrder;
        exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(res => {
          // console.log(res.receipt.gasUsed);
          assert(res.logs.length === 0);
          done();
        });
      });
    });

    it('should not log events if no value is filled', done => {
      exUtil.fill(order, { fillValueM: order.valueM, from: taker }).then(() => {
        exUtil.fill(order, { fillValueM: order.valueM, from: taker }).then(res => {
          assert(res.logs.length === 0);
          done();
        }).catch(e => {
          assert(!e);
          done();
        });
      });
    });
  });

  describe('cancel', () => {
    beforeEach(done => {
      getDmyBalances().then(newBalances => {
        balances = newBalances;
        util.createOrder(orderFactory()).then(newOrder => {
          order = newOrder;
          done();
        });
      });
    });

    it('should not cancel if not sent by maker', done => {
      const cancelValueM = order.valueM;
      exUtil.cancel(order, { cancelValueM, from: taker }).then(() => {
        const fillValueM = order.valueM;
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
        });
      });
    });

    it('should throw with an invalid caller', done => {
      exUtil.cancel(order, { cancelValueM: order.valueM, from: maker, caller: taker }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should be able to cancel a full order', done => {
      exUtil.cancel(order, { cancelValueM: order.valueM, from: maker }).then(() => {
        exUtil.fill(order, { fillValueM: 1, from: taker }).then(() => {
          getDmyBalances().then(newBalances => {
            expect(newBalances).to.deep.equal(balances);
            done();
          });
        });
      }).catch(e => {
        assert(!e);
        done();
      });
    });

    it('should be able to cancel part of an order', done => {
      const cancelValueM = div(order.valueM, 2);
      exUtil.cancel(order, { cancelValueM, from: maker }).then(() => {
        exUtil.fill(order, { fillValueM: order.valueM, from: taker }).then(res => {
          assert(res.logs[0].args.filledValueM.toString() === sub(order.valueM, cancelValueM));
          getDmyBalances().then(newBalances => {
            const cancelValueT = div(mul(cancelValueM, order.valueT), order.valueM);
            const feeValueM = div(mul(order.feeM, cancelValueM), order.valueM);
            const feeValueT = div(mul(order.feeT, cancelValueM), order.valueM);
            assert(newBalances[maker][order.tokenM] === sub(balances[maker][order.tokenM], cancelValueM));
            assert(newBalances[maker][order.tokenT] === add(balances[maker][order.tokenT], cancelValueT));
            assert(newBalances[maker][dmyPT.address] === sub(balances[maker][dmyPT.address], feeValueM));
            assert(newBalances[taker][order.tokenT] === sub(balances[taker][order.tokenT], cancelValueT));
            assert(newBalances[taker][order.tokenM] === add(balances[taker][order.tokenM], cancelValueM));
            assert(newBalances[taker][dmyPT.address] === sub(balances[taker][dmyPT.address], feeValueT));
            assert(newBalances[feeRecipient][dmyPT.address] === add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
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

    it('should not log events if no value is cancelled', done => {
      exUtil.cancel(order, { cancelValueM: order.valueM, from: maker }).then(() => {
        exUtil.cancel(order, { cancelValueM: order.valueM, from: maker }).then(res => {
          assert(res.logs.length === 0);
          done();
        });
      }).catch(e => {
        assert(!e);
        done();
      });
    });

    it('should not log events if order is expired', done => {
      util.createOrder(orderFactory({ expiration: Math.floor((Date.now() - 10000) / 1000) })).then(newOrder => {
        order = newOrder;
        exUtil.cancel(order, { cancelValueM: order.valueM, from: maker }).then(res => {
          assert(res.logs.length === 0);
          done();
        }).catch(e => {
          assert(!e);
          done();
        });
      });
    });
  });
});
