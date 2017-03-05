const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const DummyTokenB = artifacts.require('./DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');

const util = require('../../util/index.js')(web3);
const { add, sub, mul, div, toSmallestUnits } = util.BNutil;
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
      return Promise.all([
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: maker }),
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: taker }),
        dmyA.buy(INIT_BAL, { from: maker }),
        dmyA.buy(INIT_BAL, { from: taker }),
        dmyB.approve(Proxy.address, INIT_ALLOW, { from: maker }),
        dmyB.approve(Proxy.address, INIT_ALLOW, { from: taker }),
        dmyB.buy(INIT_BAL, { from: maker }),
        dmyB.buy(INIT_BAL, { from: taker }),
        dmyPT.approve(Proxy.address, INIT_ALLOW, { from: maker }),
        dmyPT.approve(Proxy.address, INIT_ALLOW, { from: taker }),
        dmyPT.buy(INIT_BAL, { from: maker }),
        dmyPT.buy(INIT_BAL, { from: taker })
      ]).then(() => done());
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
      exchange.getOrderHash(
        [order.maker, order.taker],
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        order.expiration
      ).then(orderHash => {
        assert(order.orderHash === orderHash);
        done();
      });
    });

    it('getMsgHash should output the correct msgHash', function(done) {
      exchange.getMsgHash(
        order.orderHash,
        order.feeRecipient,
        [order.feeM, order.feeT]
      ).then(msgHash => {
        assert(util.getMsgHash(order, { hex: true }) === msgHash);
        done();
      });
    });

    it('validSignature should return true with a valid signature', function(done) {
      let msgHash = util.getMsgHash(order, { hex: true });
      exchange.validSignature(order.maker, msgHash, order.v, order.r, order.s).then(success => {
        assert(util.validSignature(order));
        assert(success);
        done();
      });
    });

    it('validSignature should return false with an invalid signature', function(done) {
      order.r = util.sha3('invalidR');
      order.s = util.sha3('invalidS');
      let msgHash = util.getMsgHash(order, { hex: true });
      exchange.validSignature(order.maker, msgHash, order.v, order.r, order.s).then(success => {
        assert(!util.validSignature(order));
        assert(!success);
        done();
      });
    });

    it('validSignature should return false with an invalid message hash', function(done) {
      let msgHash = util.sha3('invalid');
      exchange.validSignature(order.maker, msgHash, order.v, order.r, order.s).then(success => {
        assert(!success);
        done();
      });
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
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(() => {
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
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(() => {
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
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(() => {
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
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(() => {
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
        let fillValueM = div(order.valueM, 2);
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(res => {
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
        let fillValueM = div(order.valueM, 2);
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(res => {
          assert(!res);
          done();
        }).catch(e => {
          assert(e);
          done();
        });
      });
    });

    it('should throw if fillValueM > valueM', function(done) {
      let fillValueM = add(order.valueM, 1);
      exchange.fill(
        [order.maker, order.taker],
        order.feeRecipient,
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        [order.feeM, order.feeT],
        order.expiration,
        fillValueM,
        order.v,
        [order.r, order.s],
        { from: taker }
      ).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should throw if fillValueM > remaining valueM', function(done) {
      let fillValueM = div(order.valueM, 2);
      exchange.fill(
        [order.maker, order.taker],
        order.feeRecipient,
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        [order.feeM, order.feeT],
        order.expiration,
        fillValueM,
        order.v,
        [order.r, order.s],
        { from: taker }
      ).then(() => {
        fillValueM = add(fillValueM, 1);
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(res => {
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
        let fillValueM = div(order.valueM, 2);
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(res => {
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
        let fillValueM = order.valueM;
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(res => {
          assert(!res);
          done();
        }).catch(e => {
          assert(e);
          done();
        });
      });
    });

    it('should log 2 events', function(done) {
      let fillValueM = div(order.valueM, 2);
      exchange.fill(
        [order.maker, order.taker],
        order.feeRecipient,
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        [order.feeM, order.feeT],
        order.expiration,
        fillValueM,
        order.v,
        [order.r, order.s],
        { from: taker }
      ).then(res => {
        assert(res.logs.length === 2);
        done();
      }).catch(e => {
        assert(!e);
        done();
      });
    });

  });

  describe('multiFill', function() {

  });

  describe('cancel', function() {
    beforeEach(function(done) {
      util.createOrder(orderFactory()).then(newOrder => {
        order = newOrder;
        done();
      });
    });

    it('should throw if not sent by maker', function(done) {
      let cancelValueM = order.valueM;
      exchange.cancel(
        [order.maker, order.taker],
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        order.expiration,
        cancelValueM,
        { from: taker }
      ).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should throw if cancelValueM === 0', function(done) {
      let cancelValueM = 0;
      exchange.cancel(
        [order.maker, order.taker],
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        order.expiration,
        cancelValueM,
        { from: maker }
      ).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should be able to cancel a full order', function(done) {
      let cancelValueM = order.valueM;
      exchange.cancel(
        [order.maker, order.taker],
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        order.expiration,
        cancelValueM,
        { from: maker }
      ).then(() => {
        let fillValueM = 1;
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(res => {
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
      let cancelValueM = div(order.valueM, 2);
      exchange.cancel(
        [order.maker, order.taker],
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        order.expiration,
        cancelValueM,
        { from: maker }
      ).then((res) => {
        let fillValueM = div(order.valueM, 4);
        exchange.fill(
          [order.maker, order.taker],
          order.feeRecipient,
          [order.tokenM, order.tokenT],
          [order.valueM, order.valueT],
          [order.feeM, order.feeT],
          order.expiration,
          fillValueM,
          order.v,
          [order.r, order.s],
          { from: taker }
        ).then(() => {
          fillValueM = add(div(order.valueM, 4), 1);
          exchange.fill(
            [order.maker, order.taker],
            order.feeRecipient,
            [order.tokenM, order.tokenT],
            [order.valueM, order.valueT],
            [order.feeM, order.feeT],
            order.expiration,
            fillValueM,
            order.v,
            [order.r, order.s],
            { from: taker }
          ).then(res => {
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
      let cancelValueM = div(order.valueM, 2);
      exchange.cancel(
        [order.maker, order.taker],
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        order.expiration,
        cancelValueM,
        { from: maker }
      ).then(res => {
        assert(res.logs.length === 1);
        done();
      }).catch(e => {
        assert(!e);
        done();
      });
    });
  });
});
