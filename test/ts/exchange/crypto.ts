import * as assert from 'assert';
import ethUtil = require('ethereumjs-util');
import { BNUtil } from '../../../util/bn_util';
import { ExchangeWrapper } from '../../../util/exchange_wrapper';
import { OrderFactory } from '../../../util/order_factory';
import { Order } from '../../../util/order';
import { Artifacts } from '../../../util/artifacts';

const {
  Exchange,
  TokenRegistry,
} = new Artifacts(artifacts);

const { toSmallestUnits } = BNUtil;

contract('Exchange', (accounts: string[]) => {
  const maker = accounts[0];
  const feeRecipient = accounts[1] || accounts[accounts.length - 1];

  let order: Order;
  let exWrapper: ExchangeWrapper;
  let orderFactory: OrderFactory;

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
      exchangeContractAddress: Exchange.address,
      maker,
      feeRecipient,
      makerToken: repAddress,
      takerToken: dgdAddress,
      makerTokenAmount: toSmallestUnits(100),
      takerTokenAmount: toSmallestUnits(200),
      makerFee: toSmallestUnits(1),
      takerFee: toSmallestUnits(1),
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
