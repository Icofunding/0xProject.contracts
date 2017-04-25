import * as _ from 'lodash';
import { Balances } from '../../../util/balances';
import { BNUtil } from '../../../util/bn_util';
import { ExchangeWrapper } from '../../../util/exchange_wrapper';
import { OrderFactory } from '../../../util/order_factory';
import { Order } from '../../../util/order';
import { testUtil } from '../../../util/test_util';
import { BalancesByOwner, ContractInstance } from '../../../util/types';
import * as assert from 'assert';

const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./tokens/DummyTokenA.sol');
const DummyTokenB = artifacts.require('./tokens/DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./tokens/DummyProtocolToken.sol');

const { add, sub, mul, div, toSmallestUnits } = BNUtil;

contract('Exchange', (accounts: string[]) => {
  const maker = accounts[0];
  const taker = accounts[1] || accounts[accounts.length - 1];
  const feeRecipient = accounts[2] || accounts[accounts.length - 1];

  const INIT_BAL = toSmallestUnits(10000);
  const INIT_ALLOW = toSmallestUnits(10000);

  let dmyA: ContractInstance;
  let dmyB: ContractInstance;
  let dmyPT: ContractInstance;
  let exchange: ContractInstance;

  let balances: BalancesByOwner;

  let exWrapper: ExchangeWrapper;
  let dmyBalances: Balances;

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

  before(async () => {
    [exchange, dmyA, dmyB, dmyPT] = await Promise.all([
      Exchange.deployed(),
      DummyTokenA.deployed(),
      DummyTokenB.deployed(),
      DummyProtocolToken.deployed(),
    ]);

    exWrapper = new ExchangeWrapper(exchange);
    dmyBalances = new Balances([dmyA, dmyB, dmyPT], [maker, taker, feeRecipient]);
    await Promise.all([
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
      const fillValueM = div(order.params.valueM, 2);
      await exWrapper.fillOrKillAsync(order, taker, { fillValueM });

      const newBalances = await dmyBalances.getAsync();
      const fillValueT = div(mul(fillValueM, order.params.valueT), order.params.valueM);
      const feeValueM = div(mul(order.params.feeM, fillValueM), order.params.valueM);
      const feeValueT = div(mul(order.params.feeT, fillValueM), order.params.valueM);
      assert.equal(newBalances[maker][order.params.tokenM], sub(balances[maker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.params.tokenT], add(balances[maker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[maker][dmyPT.address], sub(balances[maker][dmyPT.address], feeValueM));
      assert.equal(newBalances[taker][order.params.tokenT], sub(balances[taker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.params.tokenM], add(balances[taker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[taker][dmyPT.address], sub(balances[taker][dmyPT.address], feeValueT));
      assert.equal(newBalances[feeRecipient][dmyPT.address],
                   add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
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

    it('should throw if entire fillValueM not filled', async () => {
      const order = await orderFactory.newSignedOrderAsync();

      const from = taker;
      await exWrapper.fillAsync(order, from, { fillValueM: div(order.params.valueM, 2) });

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
      const fillValuesM: string[] = [];
      const tokenM = dmyA.address;
      const tokenT = dmyB.address;
      orders.forEach(order => {
        const fillValueM = div(order.params.valueM, 2);
        const fillValueT = div(mul(fillValueM, order.params.valueT), order.params.valueM);
        const feeValueM = div(mul(order.params.feeM, fillValueM), order.params.valueM);
        const feeValueT = div(mul(order.params.feeT, fillValueM), order.params.valueM);
        fillValuesM.push(fillValueM);
        balances[maker][tokenM] = sub(balances[maker][tokenM], fillValueM);
        balances[maker][tokenT] = add(balances[maker][tokenT], fillValueT);
        balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], feeValueM);
        balances[taker][tokenM] = add(balances[taker][tokenM], fillValueM);
        balances[taker][tokenT] = sub(balances[taker][tokenT], fillValueT);
        balances[taker][dmyPT.address] = sub(balances[taker][dmyPT.address], feeValueT);
        balances[feeRecipient][dmyPT.address] = add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT));
      });

      await exWrapper.batchFillAsync(orders, taker, { fillValuesM });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(balances, newBalances);
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

    it('should stop when the entire fillValueM is filled', async () => {
      const fillValueM = add(orders[0].params.valueM, div(orders[1].params.valueM, 2));
      await exWrapper.fillUpToAsync(orders, taker, { fillValueM });

      const newBalances = await dmyBalances.getAsync();

      const fillValueT = add(orders[0].params.valueT, div(orders[1].params.valueT, 2));
      const feeValueM = add(orders[0].params.feeM, div(orders[1].params.feeM, 2));
      const feeValueT = add(orders[0].params.feeT, div(orders[1].params.feeT, 2));
      assert.equal(newBalances[maker][orders[0].params.tokenM],
                   sub(balances[maker][orders[0].params.tokenM], fillValueM));
      assert.equal(newBalances[maker][orders[0].params.tokenT],
                   add(balances[maker][orders[0].params.tokenT], fillValueT));
      assert.equal(newBalances[maker][dmyPT.address],
                   sub(balances[maker][dmyPT.address], feeValueM));
      assert.equal(newBalances[taker][orders[0].params.tokenT],
                   sub(balances[taker][orders[0].params.tokenT], fillValueT));
      assert.equal(newBalances[taker][orders[0].params.tokenM],
                   add(balances[taker][orders[0].params.tokenM], fillValueM));
      assert.equal(newBalances[taker][dmyPT.address],
                   sub(balances[taker][dmyPT.address], feeValueT));
      assert.equal(newBalances[feeRecipient][dmyPT.address],
                   add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
    });

    it('should fill all orders if cannot fill entire fillValueM', async () => {
      const fillValueM = toSmallestUnits(100000);
      orders.forEach(order => {
        balances[maker][order.params.tokenM] = sub(balances[maker][order.params.tokenM], order.params.valueM);
        balances[maker][order.params.tokenT] = add(balances[maker][order.params.tokenT], order.params.valueT);
        balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], order.params.feeM);
        balances[taker][order.params.tokenM] = add(balances[taker][order.params.tokenM], order.params.valueM);
        balances[taker][order.params.tokenT] = sub(balances[taker][order.params.tokenT], order.params.valueT);
        balances[taker][dmyPT.address] = sub(balances[taker][dmyPT.address], order.params.feeT);
        balances[feeRecipient][dmyPT.address] = add(
          balances[feeRecipient][dmyPT.address], add(order.params.feeM, order.params.feeT),
        );
      });
      await exWrapper.fillUpToAsync(orders, taker, { fillValueM });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(balances, newBalances);
    });

    it('should throw when an order does not use the same tokenM', async () => {
      orders = await Promise.all([
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync({ tokenM: dmyPT.address }),
        orderFactory.newSignedOrderAsync(),
      ]);

      try {
        await exWrapper.fillUpToAsync(orders, taker, { fillValueM: toSmallestUnits(1000) });
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
      const cancelValuesM = _.map(orders, order => order.params.valueM);
      await exWrapper.batchCancelAsync(orders, maker, { cancelValuesM });

      const res = await exWrapper.batchFillAsync(orders, taker, { fillValuesM: cancelValuesM });
      assert.equal(res.logs.length, 0);
    });
  });
});
