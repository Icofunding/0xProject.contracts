const Exchange = artifacts.require('./util/Exchange.sol');
const DummyTokenA = artifacts.require('./tokens/DummyTokenA.sol');
const DummyTokenB = artifacts.require('./tokens/DummyTokenB.sol');

const assert = require('assert');
const util = require('../../util/index.js')(web3);

const { toSmallestUnits } = util.BNutil;

contract('Exchange', accounts => {
  const maker = accounts[0];
  const feeRecipient = accounts[1] || accounts[accounts.length - 1];

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

  let order;
  let exUtil;
  before(done => {
    Exchange.deployed().then(exchange => {
      exUtil = util.exchangeUtil(exchange);
      done();
    });
  });

  beforeEach(done => {
    util.createOrder(orderFactory()).then(newOrder => {
      order = newOrder;
      done();
    });
  });

  describe('getOrderHash', () => {
    it('should output the correct orderHash', done => {
      exUtil.getOrderHash(order).then(orderHash => {
        assert(`0x${order.orderHash.toString('hex')}` === orderHash);
        done();
      });
    });
  });

  describe('isValidSignature', () => {
    beforeEach(done => {
      util.createOrder(orderFactory()).then(newOrder => {
        order = newOrder;
        done();
      });
    });

    it('should return true with a valid signature', done => {
      exUtil.isValidSignature(order).then(success => {
        assert(util.isValidSignature(order));
        assert(success);
        done();
      });
    });

    it('should return false with an invalid signature', done => {
      order.r = util.sha3('invalidR');
      order.s = util.sha3('invalidS');
      exUtil.isValidSignature(order).then(success => {
        assert(!util.isValidSignature(order));
        assert(!success);
        done();
      });
    });
  });
});
