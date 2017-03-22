const Exchange = artifacts.require('./Exchange.sol');
const ExchangeWrapper = artifacts.require('./ExchangeWrapper.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./tokens/DummyTokenA.sol');
const DummyTokenB = artifacts.require('./tokens/DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./tokens/DummyProtocolToken.sol');

const assert = require('assert');
const expect = require('chai').expect;
const util = require('../../util/index.js')(web3);

const { add, sub, mul, div, toSmallestUnits } = util.BNutil;

contract('ExchangeWrapper', accounts => {
  const maker = accounts[0];
  const taker = accounts[1] || accounts[accounts.length - 1];
  const feeRecipient = accounts[2] || accounts[accounts.length - 1];

  const INIT_BAL = toSmallestUnits(10000);
  const INIT_ALLOW = toSmallestUnits(10000);

  let dmyA;
  let dmyB;
  let dmyPT;
  let exchangeW;

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
      ExchangeWrapper.deployed(),
      DummyTokenA.deployed(),
      DummyTokenB.deployed(),
      DummyProtocolToken.deployed(),
    ]).then(instances => {
      [exchangeW, dmyA, dmyB, dmyPT] = instances;
      exUtil = util.exchangeWUtil(exchangeW);
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

  describe('fill', () => {
    beforeEach(done => {
      getDmyBalances().then(newBalances => {
        balances = newBalances;
        done();
      });
    });

    it('should transfer the correct amounts', done => {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) })).then(order => {
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
  });

  describe('fillOrKill', () => {
    beforeEach(done => {
      getDmyBalances().then(newBalances => {
        balances = newBalances;
        done();
      });
    });

    it('should transfer the correct amounts', done => {
      util.createOrder(orderFactory({ valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) })).then(order => {
        const fillValueM = div(order.valueM, 2);
        exUtil.fillOrKill(order, { fillValueM, from: taker }).then(() => {
          // console.log('gasUsed:', res.receipt.gasUsed);
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

    it('should throw if an order is expired', done => {
      util.createOrder(orderFactory({ expiration: Math.floor((Date.now() - 10000) / 1000) })).then(order => {
        exUtil.fillOrKill(order, { fillValueM: order.valueM, from: taker }).catch(e => {
          assert(e);
          done();
        });
      });
    });

    it('should throw if entire fillValueM not filled', done => {
      util.createOrder(orderFactory()).then(order => {
        exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker }).then(() => {
          exUtil.fillOrKill(order, { fillValueM: order.valueM, from: taker }).catch(e => {
            assert(e);
            done();
          });
        });
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
      orders.forEach(order => {
        const fillValueM = div(order.valueM, 2);
        const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
        const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
        const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
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
          expect(newBalances).to.deep.equal(balances);
          done();
        });
      }).catch(e => {
        assert(!e);
        done();
      });
    });

    it('should throw if a single order throws', done => {
      orders[0].s = util.sha3('InvalidS');
      const fillValuesM = orders.map(order => order.valueM);
      exUtil.batchFill(orders, { fillValuesM, from: taker }).catch(e => {
        assert(e);
        done();
      });
    });
  });

  describe('fillUpTo', () => {
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

    it('should stop when the entire fillValueM is filled', done => {
      const fillValueM = add(orders[0].valueM, div(orders[1].valueM, 2));
      exUtil.fillUpTo(orders, { fillValueM, from: taker }).then(() => {
        getDmyBalances().then(newBalances => {
          const fillValueT = add(orders[0].valueT, div(orders[1].valueT, 2));
          const feeValueM = add(orders[0].feeM, div(orders[1].feeM, 2));
          const feeValueT = add(orders[0].feeT, div(orders[1].feeT, 2));
          assert(newBalances[maker][orders[0].tokenM] === sub(balances[maker][orders[0].tokenM], fillValueM));
          assert(newBalances[maker][orders[0].tokenT] === add(balances[maker][orders[0].tokenT], fillValueT));
          assert(newBalances[maker][dmyPT.address] === sub(balances[maker][dmyPT.address], feeValueM));
          assert(newBalances[taker][orders[0].tokenT] === sub(balances[taker][orders[0].tokenT], fillValueT));
          assert(newBalances[taker][orders[0].tokenM] === add(balances[taker][orders[0].tokenM], fillValueM));
          assert(newBalances[taker][dmyPT.address] === sub(balances[taker][dmyPT.address], feeValueT));
          assert(newBalances[feeRecipient][dmyPT.address] === add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
          done();
        });
      });
    });

    it('should fill all orders if cannot fill entire fillValueM', done => {
      const fillValueM = toSmallestUnits(100000);
      orders.forEach(order => {
        balances[maker][order.tokenM] = sub(balances[maker][order.tokenM], order.valueM);
        balances[maker][order.tokenT] = add(balances[maker][order.tokenT], order.valueT);
        balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], order.feeM);
        balances[taker][order.tokenM] = add(balances[taker][order.tokenM], order.valueM);
        balances[taker][order.tokenT] = sub(balances[taker][order.tokenT], order.valueT);
        balances[taker][dmyPT.address] = sub(balances[taker][dmyPT.address], order.feeT);
        balances[feeRecipient][dmyPT.address] = add(balances[feeRecipient][dmyPT.address], add(order.feeM, order.feeT));
      });
      exUtil.fillUpTo(orders, { fillValueM, from: taker }).then(() => {
        getDmyBalances().then(newBalances => {
          expect(newBalances).to.deep.equal(balances);
          done();
        });
      });
    });

    it('should throw if an order does not use the same tokenM', done => {
      Promise.all([
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory({ tokenM: dmyPT.address })),
        util.createOrder(orderFactory()),
      ]).then(newOrders => {
        orders = newOrders;
        exUtil.fillUpTo(orders, { fillValueM: toSmallestUnits(1000), from: taker }).catch(e => {
          assert(e);
          done();
        });
      });
    });
  });

  describe('batchCancel', () => {
    it('should be able to cancel multiple orders', done => {
      Promise.all([
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
      ]).then(orders => {
        const cancelValuesM = orders.map(order => order.valueM);
        exUtil.batchCancel(orders, { cancelValuesM, from: maker }).then(() => {
          exUtil.batchFill(orders, { fillValuesM: cancelValuesM, from: taker }).then(res => {
            assert(res.logs.length === 0);
            done();
          });
        });
      });
    });
  });
});
