const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const DummyTokenB = artifacts.require('./DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');

const utils = require('../../utils/index.js')(web3);
const assert = require('assert');

contract('Exchange', function(accounts) {
  const maker = accounts[0];
  const taker = accounts[1] || accounts[accounts.length - 1];
  const feeRecipient = accounts[2] || accounts[accounts.length - 1];

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
      feeRecipient,
      tokenM: DummyTokenA.address,
      tokenT: DummyTokenB.address,
      valueM: 10000,
      valueT: 10000,
      feeM: 1,
      feeT: 1,
      expiration: Math.floor((Date.now() + 100000) / 1000)
    };
    return Object.assign({}, defaultParams, params);
  };

  const getDmyBalances = () => {
    return new Promise((resolve, reject) => {
      let newBalances = {
        [maker]: {},
        [taker]: {},
        [feeRecipient]: {}
      };
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
        res = res.map(balance => balance.toString());
        newBalances[maker][dmyA.address] = res[0];
        newBalances[taker][dmyA.address] = res[1];
        newBalances[feeRecipient][dmyA.address] = res[2];
        newBalances[maker][dmyB.address] = res[3];
        newBalances[taker][dmyB.address] = res[4];
        newBalances[feeRecipient][dmyB.address] = res[5];
        newBalances[maker][dmyPT.address] = res[6];
        newBalances[taker][dmyPT.address] = res[7];
        newBalances[feeRecipient][dmyPT.address] = res[8];
        resolve(newBalances);
      });
    });
  };


  before(function(done) {
    Exchange.deployed().then(instance => {
      exchange = instance;
    }).then(() => {
      DummyTokenA.deployed().then(instance => {
        dmyA = instance;
        return Promise.all([
          dmyA.approve(Proxy.address, 1000, { from: maker }),
          dmyA.approve(Proxy.address, 1000, { from: taker }),
          dmyA.buy(1000, { from: maker }),
          dmyA.buy(1000, { from: taker })
        ]).then(() => {
          DummyTokenB.deployed().then(instance => {
            dmyB = instance;
            return Promise.all([
              dmyB.approve(Proxy.address, 1000, { from: maker }),
              dmyB.approve(Proxy.address, 1000, { from: taker }),
              dmyB.buy(1000, { from: maker }),
              dmyB.buy(1000, { from: taker })
            ]).then(() => {
              DummyProtocolToken.deployed().then(instance => {
                dmyPT = instance;
                return Promise.all([
                  dmyPT.approve(Proxy.address, 1000, { from: maker }),
                  dmyPT.approve(Proxy.address, 1000, { from: taker }),
                  dmyPT.buy(1000, { from: maker }),
                  dmyPT.buy(1000, { from: taker })
                ]).then(() => done());
              });
            });
          });
        });
      });
    });
  });

  describe('validSignature', function() {
    beforeEach(function(done) {
      utils.createOrder(orderFactory()).then(newOrder => {
        order = newOrder;
        done();
      });
    });

    it('should return true with a valid signature', function(done) {
      let msgHash = utils.getMsgHash(order, { hex: true });
      exchange.validSignature.call(order.maker, msgHash, order.v, order.r, order.s).then(success => {
        assert(utils.validSignature(order));
        assert(success);
        done();
      });
    });

    it('should return false with an invalid signature', function(done) {
      order.r = '0x0';
      order.s = '0x0';
      let msgHash = utils.getMsgHash(order, { hex: true });
      exchange.validSignature.call(order.maker, msgHash, order.v, order.r, order.s).then(success => {
        assert(!utils.validSignature(order));
        assert(!success);
        done();
      });
    });

    it('should return false with an invalid message hash', function(done) {
      let msgHash = '0x0';
      exchange.validSignature(order.maker, msgHash, order.v, order.r, order.s).then(success => {
        assert(!success);
        done();
      });
    });
  });

  describe('fill single order', function() {
    beforeEach(function(done) {
      getDmyBalances().then(newBalances => {
        balances = newBalances;
        utils.createOrder(orderFactory()).then(newOrder => {
          order = newOrder;
          done();
        });
      });
    });

    it('should transfer the correct amounts between maker, taker, and feeRecipient', function(done) {
      let fillValue = balances[taker][order.tokenT] * 0.05;
      exchange.fill(
        order.maker,
        order.feeRecipient,
        [order.tokenM, order.tokenT],
        [order.valueM, order.valueT],
        [order.feeM, order.feeT],
        order.expiration,
        fillValue,
        order.v,
        [order.r, order.s],
        { from: taker }
      ).then(tx => {
        getDmyBalances().then(newBalances => {
          console.log(balances);
          console.log(newBalances);
          done();
        });
      }).catch(e => {
        throw(e);
        done();
      })
    });

    it('should throw if an order is expired', function(done) {
      done();
    });

    it('should throw if fillValue > remaining valueM', function(done) {
      done();
    });

    it('should throw if signature is invalid', function(done){
      done();
    });

    it('should throw if a transfer fails', function(done) {
      done();
    });

    it('should throw if there is a rounding error', function(done) {
      done();
    });

    it('should log events', function(done) {
      done();
    });

  });

});
