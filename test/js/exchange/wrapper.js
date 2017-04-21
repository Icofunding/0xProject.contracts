const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./tokens/DummyTokenA.sol');
const DummyTokenB = artifacts.require('./tokens/DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./tokens/DummyProtocolToken.sol');

const assert = require('assert');
const expect = require('chai').expect;
const BNUtil = require('../../../util/BNUtil');
const exchangeUtil = require('../../../util/exchangeUtil');
const testUtil = require('../../../util/testUtil');
const OrderFactory = require('../../../util/orderFactory');
const factory = require('../../../util/factory');

const { add, sub, mul, div, toSmallestUnits } = BNUtil;

contract('Exchange', accounts => {
  const maker = accounts[0];
  const taker = accounts[1] || accounts[accounts.length - 1];
  const feeRecipient = accounts[2] || accounts[accounts.length - 1];

  const INIT_BAL = toSmallestUnits(10000);
  const INIT_ALLOW = toSmallestUnits(10000);

  let dmyA;
  let dmyB;
  let dmyPT;
  let exchange;

  let balances;

  let exUtil;
  let getDmyBalances;

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

    exUtil = exchangeUtil(exchange);
    getDmyBalances = factory.getBalancesFactory([dmyA, dmyB, dmyPT], [maker, taker, feeRecipient]);
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
      balances = await getDmyBalances();
    });

    it('should transfer the correct amounts', async () => {
      const order = await orderFactory.generateSignedOrderAsync({
        valueM: toSmallestUnits(100),
        valueT: toSmallestUnits(200),
      });
      const fillValueM = div(order.valueM, 2);
      await exUtil.fillOrKill(order, { fillValueM, from: taker });

      const newBalances = await getDmyBalances();
      const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
      const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
      const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
      assert.equal(newBalances[maker][order.tokenM], sub(balances[maker][order.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.tokenT], add(balances[maker][order.tokenT], fillValueT));
      assert.equal(newBalances[maker][dmyPT.address], sub(balances[maker][dmyPT.address], feeValueM));
      assert.equal(newBalances[taker][order.tokenT], sub(balances[taker][order.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.tokenM], add(balances[taker][order.tokenM], fillValueM));
      assert.equal(newBalances[taker][dmyPT.address], sub(balances[taker][dmyPT.address], feeValueT));
      assert.equal(newBalances[feeRecipient][dmyPT.address], add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
    });

    it('should throw if an order is expired', async () => {
      const order = await orderFactory.generateSignedOrderAsync({
        expiration: Math.floor((Date.now() - 10000) / 1000),
      });

      try {
        await exUtil.fillOrKill(order, { from: taker });
        throw new Error('FillOrKill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if entire fillValueM not filled', async () => {
      const order = await orderFactory.generateSignedOrderAsync();

      await exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker });

      try {
        await exUtil.fillOrKill(order, { from: taker });
        throw new Error('FillOrKill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('batchFill', () => {
    let orders;
    beforeEach(async () => {
      orders = await Promise.all([
        orderFactory.generateSignedOrderAsync(),
        orderFactory.generateSignedOrderAsync(),
        orderFactory.generateSignedOrderAsync(),
      ]);
      balances = await getDmyBalances();
    });

    it('should transfer the correct amounts', async () => {
      const fillValuesM = [];
      const tokenM = dmyA.address;
      const tokenT = dmyB.address;
      orders.forEach(order => {
        const fillValueM = div(order.valueM, 2);
        const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
        const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
        const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
        fillValuesM.push(fillValueM);
        balances[maker][tokenM] = sub(balances[maker][tokenM], fillValueM);
        balances[maker][tokenT] = add(balances[maker][tokenT], fillValueT);
        balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], feeValueM);
        balances[taker][tokenM] = add(balances[taker][tokenM], fillValueM);
        balances[taker][tokenT] = sub(balances[taker][tokenT], fillValueT);
        balances[taker][dmyPT.address] = sub(balances[taker][dmyPT.address], feeValueT);
        balances[feeRecipient][dmyPT.address] = add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT));
      });

      await exUtil.batchFill(orders, { fillValuesM, from: taker });

      const newBalances = await getDmyBalances();
      expect(newBalances).to.deep.equal(balances);
    });
  });

  describe('fillUpTo', () => {
    let orders;
    beforeEach(async () => {
      orders = await Promise.all([
        orderFactory.generateSignedOrderAsync(),
        orderFactory.generateSignedOrderAsync(),
        orderFactory.generateSignedOrderAsync(),
      ]);
      balances = await getDmyBalances();
    });

    it('should stop when the entire fillValueM is filled', async () => {
      const fillValueM = add(orders[0].valueM, div(orders[1].valueM, 2));
      await exUtil.fillUpTo(orders, { fillValueM, from: taker });

      const newBalances = await getDmyBalances();

      const fillValueT = add(orders[0].valueT, div(orders[1].valueT, 2));
      const feeValueM = add(orders[0].feeM, div(orders[1].feeM, 2));
      const feeValueT = add(orders[0].feeT, div(orders[1].feeT, 2));
      assert.equal(newBalances[maker][orders[0].tokenM], sub(balances[maker][orders[0].tokenM], fillValueM));
      assert.equal(newBalances[maker][orders[0].tokenT], add(balances[maker][orders[0].tokenT], fillValueT));
      assert.equal(newBalances[maker][dmyPT.address], sub(balances[maker][dmyPT.address], feeValueM));
      assert.equal(newBalances[taker][orders[0].tokenT], sub(balances[taker][orders[0].tokenT], fillValueT));
      assert.equal(newBalances[taker][orders[0].tokenM], add(balances[taker][orders[0].tokenM], fillValueM));
      assert.equal(newBalances[taker][dmyPT.address], sub(balances[taker][dmyPT.address], feeValueT));
      assert.equal(newBalances[feeRecipient][dmyPT.address], add(balances[feeRecipient][dmyPT.address], add(feeValueM, feeValueT)));
    });

    it('should fill all orders if cannot fill entire fillValueM', async () => {
      const fillValueM = toSmallestUnits(100000);
      orders.forEach(order => {
        balances[maker][order.tokenM] = sub(balances[maker][order.tokenM], order.valueM);
        balances[maker][order.tokenT] = add(balances[maker][order.tokenT], order.valueT);
        balances[maker][dmyPT.address] = sub(balances[maker][dmyPT.address], order.feeM);
        balances[taker][order.tokenM] = add(balances[taker][order.tokenM], order.valueM);
        balances[taker][order.tokenT] = sub(balances[taker][order.tokenT], order.valueT);
        balances[taker][dmyPT.address] = sub(balances[taker][dmyPT.address], order.feeT);
        balances[feeRecipient][dmyPT.address] = add(balances[feeRecipient][dmyPT.address], add(order.feeM, order.feeT));
      });
      await exUtil.fillUpTo(orders, { fillValueM, from: taker });

      const newBalances = await getDmyBalances();
      expect(newBalances).to.deep.equal(balances);
    });

    it('should throw when an order does not use the same tokenM', async () => {
      orders = await Promise.all([
        orderFactory.generateSignedOrderAsync(),
        orderFactory.generateSignedOrderAsync({ tokenM: dmyPT.address }),
        orderFactory.generateSignedOrderAsync(),
      ]);

      try {
        await exUtil.fillUpTo(orders, { fillValueM: toSmallestUnits(1000), from: taker });
        throw new Error('FillUpTo succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('batchCancel', () => {
    it('should be able to cancel multiple orders', async () => {
      const orders = await Promise.all([
        orderFactory.generateSignedOrderAsync(),
        orderFactory.generateSignedOrderAsync(),
        orderFactory.generateSignedOrderAsync(),
      ]);
      const cancelValuesM = orders.map(order => order.valueM);
      await exUtil.batchCancel(orders, { cancelValuesM, from: maker });

      const res = await exUtil.batchFill(orders, { fillValuesM: cancelValuesM, from: taker });
      assert.equal(res.logs.length, 0);
    });
  });
});
