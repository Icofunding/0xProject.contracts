import { BNUtil } from '../../../util/bn_util';
import { ExchangeWrapper } from '../../../util/exchange_wrapper';
import { OrderFactory } from '../../../util/order_factory';
import { Order } from '../../../util/order';
import * as assert from 'assert';
import ethUtil = require('ethereumjs-util');

const Exchange = artifacts.require('./util/Exchange.sol');
const DummyTokenA = artifacts.require('./tokens/DummyTokenA.sol');
const DummyTokenB = artifacts.require('./tokens/DummyTokenB.sol');

const { toSmallestUnits } = BNUtil;

contract('Exchange', (accounts: string[]) => {
  const maker = accounts[0];
  const feeRecipient = accounts[1] || accounts[accounts.length - 1];

  const defaultOrderParams = {
    exchange: Exchange.address,
    maker,
    feeRecipient,
    tokenM: DummyTokenA.address,
    tokenT: DummyTokenB.address,
    valueM: toSmallestUnits(100),
    valueT: toSmallestUnits(200),
    feeM: toSmallestUnits(1),
    feeT: toSmallestUnits(1),
  };
  const orderFactory = new OrderFactory(defaultOrderParams);

  let order: Order;
  let exWrapper: ExchangeWrapper;

  before(async () => {
    const exchange = await Exchange.deployed();
    exWrapper = new ExchangeWrapper(exchange);
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
