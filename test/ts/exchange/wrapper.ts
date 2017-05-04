import * as _ from 'lodash';
import * as assert from 'assert';
import { Balances } from '../../../util/balances';
import { BNUtil } from '../../../util/bn_util';
import { ExchangeWrapper } from '../../../util/exchange_wrapper';
import { OrderFactory } from '../../../util/order_factory';
import { Order } from '../../../util/order';
import { testUtil } from '../../../util/test_util';
import { BalancesByOwner, ContractInstance } from '../../../util/types';
import { Artifacts } from '../../../util/artifacts';

const {
  Exchange,
  Proxy,
  DummyToken,
  TokenRegistry,
} = new Artifacts(artifacts);

const { add, sub, mul, div, toSmallestUnits } = BNUtil;

contract('Exchange', (accounts: string[]) => {
  const maker = accounts[0];
  const tokenOwner = accounts[0];
  const taker = accounts[1] || accounts[accounts.length - 1];
  const feeRecipient = accounts[2] || accounts[accounts.length - 1];

  const INIT_BAL = toSmallestUnits(10000);
  const INIT_ALLOW = toSmallestUnits(10000);

  let rep: ContractInstance;
  let dgd: ContractInstance;
  let zrx: ContractInstance;
  let exchange: ContractInstance;
  let tokenRegistry: ContractInstance;

  let balances: BalancesByOwner;

  let exWrapper: ExchangeWrapper;
  let dmyBalances: Balances;
  let orderFactory: OrderFactory;

  before(async () => {
    [tokenRegistry, exchange] = await Promise.all([
      TokenRegistry.deployed(),
      Exchange.deployed(),
    ]);
    exWrapper = new ExchangeWrapper(exchange);
    const [repAddress, dgdAddress, zrxAddress] = await Promise.all([
      tokenRegistry.getTokenAddressBySymbol('REP'),
      tokenRegistry.getTokenAddressBySymbol('DGD'),
      tokenRegistry.getTokenAddressBySymbol('ZRX'),
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

    [rep, dgd, zrx] = await Promise.all([
      DummyToken.at(repAddress),
      DummyToken.at(dgdAddress),
      DummyToken.at(zrxAddress),
    ]);
    dmyBalances = new Balances([rep, dgd, zrx], [maker, taker, feeRecipient]);
    await Promise.all([
      rep.approve(Proxy.address, INIT_ALLOW, { from: maker }),
      rep.approve(Proxy.address, INIT_ALLOW, { from: taker }),
      rep.setBalance(maker, INIT_BAL, { from: tokenOwner }),
      rep.setBalance(taker, INIT_BAL, { from: tokenOwner }),
      dgd.approve(Proxy.address, INIT_ALLOW, { from: maker }),
      dgd.approve(Proxy.address, INIT_ALLOW, { from: taker }),
      dgd.setBalance(maker, INIT_BAL, { from: tokenOwner }),
      dgd.setBalance(taker, INIT_BAL, { from: tokenOwner }),
      zrx.approve(Proxy.address, INIT_ALLOW, { from: maker }),
      zrx.approve(Proxy.address, INIT_ALLOW, { from: taker }),
      zrx.setBalance(maker, INIT_BAL, { from: tokenOwner }),
      zrx.setBalance(taker, INIT_BAL, { from: tokenOwner }),
    ]);
  });

  describe('fillOrKill', () => {
    beforeEach(async () => {
      balances = await dmyBalances.getAsync();
    });

    it('should transfer the correct amounts', async () => {
      const order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(100),
        valueT: toSmallestUnits(200),
      });
      const fillValueT = div(order.params.valueT, 2);
      await exWrapper.fillOrKillAsync(order, taker, { fillValueT });

      const newBalances = await dmyBalances.getAsync();

      const fillValueM = div(mul(fillValueT, order.params.valueM), order.params.valueT);
      const feeValueM = div(mul(order.params.feeM, fillValueM), order.params.valueM);
      const feeValueT = div(mul(order.params.feeT, fillValueM), order.params.valueM);
      assert.equal(newBalances[maker][order.params.tokenM], sub(balances[maker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.params.tokenT], add(balances[maker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.params.tokenT], sub(balances[taker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.params.tokenM], add(balances[taker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address],
                   add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should throw if an order is expired', async () => {
      const order = await orderFactory.newSignedOrderAsync({
        expiration: Math.floor((Date.now() - 10000) / 1000),
      });

      try {
        await exWrapper.fillOrKillAsync(order, taker);
        throw new Error('FillOrKill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if entire fillValueT not filled', async () => {
      const order = await orderFactory.newSignedOrderAsync();

      const from = taker;
      await exWrapper.fillAsync(order, from, { fillValueT: div(order.params.valueT, 2) });

      try {
        await exWrapper.fillOrKillAsync(order, taker);
        throw new Error('FillOrKill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('batchFill', () => {
    let orders: Order[];
    beforeEach(async () => {
      orders = await Promise.all([
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync(),
      ]);
      balances = await dmyBalances.getAsync();
    });

    it('should transfer the correct amounts', async () => {
      const fillValuesT: string[] = [];
      const tokenM = rep.address;
      const tokenT = dgd.address;
      orders.forEach(order => {
        const fillValueT = div(order.params.valueT, 2);
        const fillValueM = div(mul(fillValueT, order.params.valueM), order.params.valueT);
        const feeValueM = div(mul(order.params.feeM, fillValueM), order.params.valueM);
        const feeValueT = div(mul(order.params.feeT, fillValueM), order.params.valueM);
        fillValuesT.push(fillValueT);
        balances[maker][tokenM] = sub(balances[maker][tokenM], fillValueM);
        balances[maker][tokenT] = add(balances[maker][tokenT], fillValueT);
        balances[maker][zrx.address] = sub(balances[maker][zrx.address], feeValueM);
        balances[taker][tokenM] = add(balances[taker][tokenM], fillValueM);
        balances[taker][tokenT] = sub(balances[taker][tokenT], fillValueT);
        balances[taker][zrx.address] = sub(balances[taker][zrx.address], feeValueT);
        balances[feeRecipient][zrx.address] = add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT));
      });

      await exWrapper.batchFillAsync(orders, taker, { fillValuesT });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });
  });

  describe('fillUpTo', () => {
    let orders: Order[];
    beforeEach(async () => {
      orders = await Promise.all([
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync(),
      ]);
      balances = await dmyBalances.getAsync();
    });

    it('should stop when the entire fillValueT is filled', async () => {
      const fillValueT = add(orders[0].params.valueT, div(orders[1].params.valueT, 2));
      await exWrapper.fillUpToAsync(orders, taker, { fillValueT });

      const newBalances = await dmyBalances.getAsync();

      const fillValueM = add(orders[0].params.valueM, div(orders[1].params.valueM, 2));
      const feeValueM = add(orders[0].params.feeM, div(orders[1].params.feeM, 2));
      const feeValueT = add(orders[0].params.feeT, div(orders[1].params.feeT, 2));
      assert.equal(newBalances[maker][orders[0].params.tokenM],
                   sub(balances[maker][orders[0].params.tokenM], fillValueM));
      assert.equal(newBalances[maker][orders[0].params.tokenT],
                   add(balances[maker][orders[0].params.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][orders[0].params.tokenT],
                   sub(balances[taker][orders[0].params.tokenT], fillValueT));
      assert.equal(newBalances[taker][orders[0].params.tokenM],
                   add(balances[taker][orders[0].params.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address],
                   add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should fill all orders if cannot fill entire fillValueT', async () => {
      const fillValueT = toSmallestUnits(100000);
      orders.forEach(order => {
        balances[maker][order.params.tokenM] = sub(balances[maker][order.params.tokenM], order.params.valueM);
        balances[maker][order.params.tokenT] = add(balances[maker][order.params.tokenT], order.params.valueT);
        balances[maker][zrx.address] = sub(balances[maker][zrx.address], order.params.feeM);
        balances[taker][order.params.tokenM] = add(balances[taker][order.params.tokenM], order.params.valueM);
        balances[taker][order.params.tokenT] = sub(balances[taker][order.params.tokenT], order.params.valueT);
        balances[taker][zrx.address] = sub(balances[taker][zrx.address], order.params.feeT);
        balances[feeRecipient][zrx.address] = add(
          balances[feeRecipient][zrx.address], add(order.params.feeM, order.params.feeT),
        );
      });
      await exWrapper.fillUpToAsync(orders, taker, { fillValueT });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw when an order does not use the same tokenT', async () => {
      orders = await Promise.all([
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync({ tokenT: zrx.address }),
        orderFactory.newSignedOrderAsync(),
      ]);

      try {
        await exWrapper.fillUpToAsync(orders, taker, { fillValueT: toSmallestUnits(1000) });
        throw new Error('FillUpTo succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('batchCancel', () => {
    it('should be able to cancel multiple orders', async () => {
      const orders = await Promise.all([
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync(),
      ]);
      const cancelValuesT = _.map(orders, order => order.params.valueT);
      await exWrapper.batchCancelAsync(orders, maker, { cancelValuesT });

      const res = await exWrapper.batchFillAsync(orders, taker, { fillValuesT: cancelValuesT });
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(balances, newBalances);
    });
  });
});
