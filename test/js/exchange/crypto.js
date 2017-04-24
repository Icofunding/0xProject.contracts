const Exchange = artifacts.require('./util/Exchange.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');

const assert = require('assert');
const ethUtil = require('ethereumjs-util');
const BNUtil = require('../../../util/bn_util');
const ExchangeWrapper = require('../../../util/exchange_wrapper');
const OrderFactory = require('../../../util/order_factory');

const { toSmallestUnits } = BNUtil;

contract('Exchange', accounts => {
  const maker = accounts[0];
  const feeRecipient = accounts[1] || accounts[accounts.length - 1];

  let order;
  let exWrapper;
  let orderFactory;

  before(async () => {
    const [tokenRegistry, exchange] = await Promise.all([
      TokenRegistry.deployed(),
      Exchange.deployed(),
    ]);
    exWrapper = new ExchangeWrapper(exchange);
    const [repAddress, dgdAddress] = await Promise.all([
      tokenRegistry.getTokenAddressBySymbol('REP'),
      tokenRegistry.getTokenAddressBySymbol('DGD'),
    ]);
    const defaultOrderParams = {
      exchange: Exchange.address,
      maker,
      feeRecipient,
      tokenM: repAddress,
      tokenT: dgdAddress,
      valueM: toSmallestUnits(100),
      valueT: toSmallestUnits(200),
      feeM: toSmallestUnits(1),
      feeT: toSmallestUnits(1),
    };
    orderFactory = new OrderFactory(defaultOrderParams);
  });

  beforeEach(async () => {
    order = await orderFactory.newSignedOrderAsync();
  });

  describe('getOrderHash', () => {
    it('should output the correct orderHash', async () => {
      const orderHashHex = await exWrapper.getOrderHashAsync(order);
      assert.equal(order.params.orderHashHex, orderHashHex);
    });
  });

  describe('isValidSignature', () => {
    beforeEach(async () => {
      order = await orderFactory.newSignedOrderAsync();
    });

    it('should return true with a valid signature', async () => {
      const success = await exWrapper.isValidSignatureAsync(order);
      const isValidSignature = order.isValidSignature();
      assert(isValidSignature);
      assert(success);
    });

    it('should return false with an invalid signature', async () => {
      order.params.r = ethUtil.bufferToHex(ethUtil.sha3('invalidR'));
      order.params.s = ethUtil.bufferToHex(ethUtil.sha3('invalidS'));
      const success = await exWrapper.isValidSignatureAsync(order);
      assert(!order.isValidSignature());
      assert(!success);
    });
  });
});
