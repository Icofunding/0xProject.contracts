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
import * as BigNumber from 'bignumber.js';

const {
  Exchange,
  TokenProxy,
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

    [rep, dgd, zrx] = await Promise.all([
      DummyToken.at(repAddress),
      DummyToken.at(dgdAddress),
      DummyToken.at(zrxAddress),
    ]);
    dmyBalances = new Balances([rep, dgd, zrx], [maker, taker, feeRecipient]);
    await Promise.all([
      rep.approve(TokenProxy.address, INIT_ALLOW, { from: maker }),
      rep.approve(TokenProxy.address, INIT_ALLOW, { from: taker }),
      rep.setBalance(maker, INIT_BAL, { from: tokenOwner }),
      rep.setBalance(taker, INIT_BAL, { from: tokenOwner }),
      dgd.approve(TokenProxy.address, INIT_ALLOW, { from: maker }),
      dgd.approve(TokenProxy.address, INIT_ALLOW, { from: taker }),
      dgd.setBalance(maker, INIT_BAL, { from: tokenOwner }),
      dgd.setBalance(taker, INIT_BAL, { from: tokenOwner }),
      zrx.approve(TokenProxy.address, INIT_ALLOW, { from: maker }),
      zrx.approve(TokenProxy.address, INIT_ALLOW, { from: taker }),
      zrx.setBalance(maker, INIT_BAL, { from: tokenOwner }),
      zrx.setBalance(taker, INIT_BAL, { from: tokenOwner }),
    ]);
  });

  describe('fillOrKillOrder', () => {
    beforeEach(async () => {
      balances = await dmyBalances.getAsync();
    });

    it('should transfer the correct amounts', async () => {
      const order = await orderFactory.newSignedOrderAsync({
        makerTokenAmount: toSmallestUnits(100),
        takerTokenAmount: toSmallestUnits(200),
      });
      const fillTakerTokenAmount = order.params.takerTokenAmount.div(2);
      await exWrapper.fillOrKillOrderAsync(order, taker, { fillTakerTokenAmount });

      const newBalances = await dmyBalances.getAsync();

      const fillMakerTokenAmount = div(mul(fillTakerTokenAmount, order.params.makerTokenAmount),
                                       order.params.takerTokenAmount);
      const makerFee = div(mul(order.params.makerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      const takerFee = div(mul(order.params.takerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      assert.equal(newBalances[maker][order.params.makerToken],
                   sub(balances[maker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[maker][order.params.takerToken],
                   add(balances[maker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], makerFee));
      assert.equal(newBalances[taker][order.params.takerToken],
                   sub(balances[taker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[taker][order.params.makerToken],
                   add(balances[taker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], takerFee));
      assert.equal(newBalances[feeRecipient][zrx.address],
                   add(balances[feeRecipient][zrx.address], add(makerFee, takerFee)));
    });

    it('should throw if an order is expired', async () => {
      const order = await orderFactory.newSignedOrderAsync({
        expirationTimestampInSec: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
      });

      try {
        await exWrapper.fillOrKillOrderAsync(order, taker);
        throw new Error('FillOrKill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if entire fillTakerTokenAmount not filled', async () => {
      const order = await orderFactory.newSignedOrderAsync();

      const from = taker;
      await exWrapper.fillOrderAsync(order, from, { fillTakerTokenAmount: order.params.takerTokenAmount.div(2) });

      try {
        await exWrapper.fillOrKillOrderAsync(order, taker);
        throw new Error('FillOrKill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('batch functions', () => {
    let orders: Order[];
    beforeEach(async () => {
      orders = await Promise.all([
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync(),
        orderFactory.newSignedOrderAsync(),
      ]);
      balances = await dmyBalances.getAsync();
    });

    describe('batchFillOrders', () => {
      it('should transfer the correct amounts', async () => {
        const fillTakerTokenAmounts: BigNumber.BigNumber[] = [];
        const makerToken = rep.address;
        const takerToken = dgd.address;
        orders.forEach(order => {
          const fillTakerTokenAmount = order.params.takerTokenAmount.div(2);
          const fillMakerTokenAmount = div(mul(fillTakerTokenAmount, order.params.makerTokenAmount),
                                           order.params.takerTokenAmount);
          const makerFee = div(mul(order.params.makerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
          const takerFee = div(mul(order.params.takerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
          fillTakerTokenAmounts.push(fillTakerTokenAmount);
          balances[maker][makerToken] = sub(balances[maker][makerToken], fillMakerTokenAmount);
          balances[maker][takerToken] = add(balances[maker][takerToken], fillTakerTokenAmount);
          balances[maker][zrx.address] = sub(balances[maker][zrx.address], makerFee);
          balances[taker][makerToken] = add(balances[taker][makerToken], fillMakerTokenAmount);
          balances[taker][takerToken] = sub(balances[taker][takerToken], fillTakerTokenAmount);
          balances[taker][zrx.address] = sub(balances[taker][zrx.address], takerFee);
          balances[feeRecipient][zrx.address] = add(balances[feeRecipient][zrx.address], add(makerFee, takerFee));
        });

        await exWrapper.batchFillOrdersAsync(orders, taker, { fillTakerTokenAmounts });

        const newBalances = await dmyBalances.getAsync();
        assert.deepEqual(newBalances, balances);
      });
    });

    describe('batchFillOrKillOrders', () => {
      it('should transfer the correct amounts', async () => {
        const fillTakerTokenAmounts: BigNumber.BigNumber[] = [];
        const makerToken = rep.address;
        const takerToken = dgd.address;
        orders.forEach(order => {
          const fillTakerTokenAmount = order.params.takerTokenAmount.div(2);
          const fillMakerTokenAmount = div(mul(fillTakerTokenAmount, order.params.makerTokenAmount),
                                           order.params.takerTokenAmount);
          const makerFee = div(mul(order.params.makerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
          const takerFee = div(mul(order.params.takerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
          fillTakerTokenAmounts.push(fillTakerTokenAmount);
          balances[maker][makerToken] = sub(balances[maker][makerToken], fillMakerTokenAmount);
          balances[maker][takerToken] = add(balances[maker][takerToken], fillTakerTokenAmount);
          balances[maker][zrx.address] = sub(balances[maker][zrx.address], makerFee);
          balances[taker][makerToken] = add(balances[taker][makerToken], fillMakerTokenAmount);
          balances[taker][takerToken] = sub(balances[taker][takerToken], fillTakerTokenAmount);
          balances[taker][zrx.address] = sub(balances[taker][zrx.address], takerFee);
          balances[feeRecipient][zrx.address] = add(balances[feeRecipient][zrx.address], add(makerFee, takerFee));
        });

        await exWrapper.batchFillOrKillOrdersAsync(orders, taker, { fillTakerTokenAmounts });

        const newBalances = await dmyBalances.getAsync();
        assert.deepEqual(newBalances, balances);
      });

      it('should throw if a single order does not fill the expected amount', async () => {
        const fillTakerTokenAmounts: BigNumber.BigNumber[] = [];
        const makerToken = rep.address;
        const takerToken = dgd.address;
        orders.forEach(order => {
          const fillTakerTokenAmount = order.params.takerTokenAmount.div(2);
          fillTakerTokenAmounts.push(fillTakerTokenAmount);
        });

        await exWrapper.fillOrKillOrderAsync(orders[0], taker);

        try {
          await exWrapper.batchFillOrKillOrdersAsync(orders, taker, { fillTakerTokenAmounts });
          throw new Error('batchFillOrKillOrders succeeded when it should have failed');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });
    });

    describe('fillOrdersUpTo', () => {
      it('should stop when the entire fillTakerTokenAmount is filled', async () => {
        const fillTakerTokenAmount = orders[0].params.takerTokenAmount.plus(orders[1].params.takerTokenAmount.div(2));
        await exWrapper.fillOrdersUpToAsync(orders, taker, { fillTakerTokenAmount });

        const newBalances = await dmyBalances.getAsync();

        const fillMakerTokenAmount = add(orders[0].params.makerTokenAmount, div(orders[1].params.makerTokenAmount, 2));
        const makerFee = add(orders[0].params.makerFee, div(orders[1].params.makerFee, 2));
        const takerFee = add(orders[0].params.takerFee, div(orders[1].params.takerFee, 2));
        assert.equal(newBalances[maker][orders[0].params.makerToken],
                     sub(balances[maker][orders[0].params.makerToken], fillMakerTokenAmount));
        assert.equal(newBalances[maker][orders[0].params.takerToken],
                     add(balances[maker][orders[0].params.takerToken], fillTakerTokenAmount));
        assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], makerFee));
        assert.equal(newBalances[taker][orders[0].params.takerToken],
                     sub(balances[taker][orders[0].params.takerToken], fillTakerTokenAmount));
        assert.equal(newBalances[taker][orders[0].params.makerToken],
                     add(balances[taker][orders[0].params.makerToken], fillMakerTokenAmount));
        assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], takerFee));
        assert.equal(newBalances[feeRecipient][zrx.address],
                     add(balances[feeRecipient][zrx.address], add(makerFee, takerFee)));
      });

      it('should fill all orders if cannot fill entire fillTakerTokenAmount', async () => {
        const fillTakerTokenAmount = toSmallestUnits(100000);
        orders.forEach(order => {
          balances[maker][order.params.makerToken] = sub(balances[maker][order.params.makerToken],
                                                         order.params.makerTokenAmount);
          balances[maker][order.params.takerToken] = add(balances[maker][order.params.takerToken],
                                                         order.params.takerTokenAmount);
          balances[maker][zrx.address] = sub(balances[maker][zrx.address], order.params.makerFee);
          balances[taker][order.params.makerToken] = add(balances[taker][order.params.makerToken],
                                                         order.params.makerTokenAmount);
          balances[taker][order.params.takerToken] = sub(balances[taker][order.params.takerToken],
                                                         order.params.takerTokenAmount);
          balances[taker][zrx.address] = sub(balances[taker][zrx.address], order.params.takerFee);
          balances[feeRecipient][zrx.address] = add(
            balances[feeRecipient][zrx.address], add(order.params.makerFee, order.params.takerFee),
          );
        });
        await exWrapper.fillOrdersUpToAsync(orders, taker, { fillTakerTokenAmount });

        const newBalances = await dmyBalances.getAsync();
        assert.deepEqual(newBalances, balances);
      });

      it('should throw when an order does not use the same takerToken', async () => {
        orders = await Promise.all([
          orderFactory.newSignedOrderAsync(),
          orderFactory.newSignedOrderAsync({ takerToken: zrx.address }),
          orderFactory.newSignedOrderAsync(),
        ]);

        try {
          await exWrapper.fillOrdersUpToAsync(orders, taker, { fillTakerTokenAmount: toSmallestUnits(1000) });
          throw new Error('FillUpTo succeeded when it should have thrown');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });
    });

    describe('batchCancelOrders', () => {
      it('should be able to cancel multiple orders', async () => {
        const cancelTakerTokenAmounts = _.map(orders, order => order.params.takerTokenAmount);
        await exWrapper.batchCancelOrdersAsync(orders, maker, { cancelTakerTokenAmounts });

        const res = await exWrapper.batchFillOrdersAsync(orders, taker, { fillTakerTokenAmounts: cancelTakerTokenAmounts });
        const newBalances = await dmyBalances.getAsync();
        assert.deepEqual(balances, newBalances);
      });
    });
  });
});
