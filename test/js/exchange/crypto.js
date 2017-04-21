const Exchange = artifacts.require('./util/Exchange.sol');
const DummyTokenA = artifacts.require('./tokens/DummyTokenA.sol');
const DummyTokenB = artifacts.require('./tokens/DummyTokenB.sol');

const assert = require('assert');
const ethUtil = require('ethereumjs-util');
const BNUtil = require('../../../util/BNUtil');
const crypto = require('../../../util/crypto');
const exchangeUtil = require('../../../util/exchangeUtil');
const util = require('../../../util/index.js')(web3);

const { toSmallestUnits } = BNUtil;

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
  before(async () => {
    const exchange = await Exchange.deployed();
    exUtil = exchangeUtil(exchange);
  });

  beforeEach(async () => {
    order = await util.createOrder(orderFactory());
  });

  describe('getOrderHash', () => {
    it('should output the correct orderHash', async () => {
      const orderHash = await exUtil.getOrderHash(order);
      assert.equal(`0x${order.orderHash.toString('hex')}`, orderHash);
    });
  });

  describe('isValidSignature', () => {
    beforeEach(async () => {
      order = await util.createOrder(orderFactory());
    });

    it('should return true with a valid signature', async () => {
      const success = await exUtil.isValidSignature(order);
      assert(crypto.isValidSignature(order));
      assert(success);
    });

    it('should return false with an invalid signature', async () => {
      order.r = ethUtil.sha3('invalidR');
      order.s = ethUtil.sha3('invalidS');
      const success = await exUtil.isValidSignature(order);
      assert(!crypto.isValidSignature(order));
      assert(!success);
    });
  });
});
