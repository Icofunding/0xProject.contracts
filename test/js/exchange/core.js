require('babel-polyfill');
require('source-map-support/register');

const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyToken = artifacts.require('./tokens/DummyToken.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');

const assert = require('assert');
const ethUtil = require('ethereumjs-util');
const BNUtil = require('../../../util/bn_util');
const ExchangeWrapper = require('../../../util/exchange_wrapper');
const OrderFactory = require('../../../util/order_factory');
const testUtil = require('../../../util/test_util');
const Balances = require('../../../util/balances');

const { add, sub, mul, div, toSmallestUnits } = BNUtil;

contract('Exchange', accounts => {
  const maker = accounts[0];
  const tokenOwner = accounts[0];
  const taker = accounts[1] || accounts[accounts.length - 1];
  const feeRecipient = accounts[2] || accounts[accounts.length - 1];

  const INIT_BAL = toSmallestUnits(10000);
  const INIT_ALLOW = toSmallestUnits(10000);

  let rep;
  let dgd;
  let zrx;
  let exchange;
  let tokenRegistry;

  let order;
  let balances;

  let exWrapper;
  let dmyBalances;
  let orderFactory;

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

  describe('private functions', () => {
    it('should include transferViaProxy', () => {
      assert.equal(exchange.transferViaProxy, undefined);
    });

    it('should include fillSuccess', () => {
      assert.equal(exchange.fillSuccess, undefined);
    });

    it('should include cancelSuccess', () => {
      assert.equal(exchange.cancelSuccess, undefined);
    });

    it('should include isTransferable', () => {
      assert.equal(exchange.isTransferable, undefined);
    });

    it('should include getBalance', () => {
      assert.equal(exchange.getBalance, undefined);
    });

    it('should include getAllowance', () => {
      assert.equal(exchange.getAllowance, undefined);
    });
  });

  describe('fill', () => {
    beforeEach(async () => {
      balances = await dmyBalances.getAsync();
      order = await orderFactory.newSignedOrderAsync();
    });

    it('should transfer the correct amounts when valueM === valueT', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(100),
        valueT: toSmallestUnits(100),
      });

      const filledAmountMBefore = await exchange.fills.call(order.params.orderHashHex);
      assert.equal(filledAmountMBefore, 0, 'filledAmountMBefore should be 0');

      const fillValueM = div(order.params.valueM, 2);
      await exWrapper.fillAsync(order, { fillValueM, from: taker });

      const filledAmountMAfter = await exchange.fills.call(order.params.orderHashHex);
      assert.equal(filledAmountMAfter, fillValueM, 'filledAmountMAfter should be same as fillValueM');

      const newBalances = await dmyBalances.getAsync();
      const fillValueT = div(mul(fillValueM, order.params.valueT), order.params.valueM);
      const feeValueM = div(mul(order.params.feeM, fillValueM), order.params.valueM);
      const feeValueT = div(mul(order.params.feeT, fillValueM), order.params.valueM);
      assert.equal(newBalances[maker][order.params.tokenM], sub(balances[maker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.params.tokenT], add(balances[maker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.params.tokenT], sub(balances[taker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.params.tokenM], add(balances[taker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should transfer the correct amounts when valueM > valueT', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(200),
        valueT: toSmallestUnits(100),
      });

      const filledAmountMBefore = await exchange.fills.call(order.params.orderHashHex);
      assert.equal(filledAmountMBefore, 0, 'filledAmountMBefore should be 0');

      const fillValueM = div(order.params.valueM, 2);
      await exWrapper.fillAsync(order, { fillValueM, from: taker });

      const filledAmountMAfter = await exchange.fills.call(order.params.orderHashHex);
      assert.equal(filledAmountMAfter, fillValueM, 'filledAmountMAfter should be same as fillValueM');

      const newBalances = await dmyBalances.getAsync();

      const fillValueT = div(mul(fillValueM, order.params.valueT), order.params.valueM);
      const feeValueM = div(mul(order.params.feeM, fillValueM), order.params.valueM);
      const feeValueT = div(mul(order.params.feeT, fillValueM), order.params.valueM);
      assert.equal(newBalances[maker][order.params.tokenM], sub(balances[maker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.params.tokenT], add(balances[maker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.params.tokenT], sub(balances[taker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.params.tokenM], add(balances[taker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should transfer the correct amounts when valueM < valueT', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(100),
        valueT: toSmallestUnits(200),
      });

      const filledAmountMBefore = await exchange.fills.call(order.params.orderHashHex);
      assert.equal(filledAmountMBefore, 0, 'filledAmountMBefore should be 0');

      const fillValueM = div(order.params.valueM, 2);
      await exWrapper.fillAsync(order, { fillValueM, from: taker });

      const filledAmountMAfter = await exchange.fills.call(order.params.orderHashHex);
      assert.equal(filledAmountMAfter, fillValueM, 'filledAmountMAfter should be same as fillValueM');

      const newBalances = await dmyBalances.getAsync();

      const fillValueT = div(mul(fillValueM, order.params.valueT), order.params.valueM);
      const feeValueM = div(mul(order.params.feeM, fillValueM), order.params.valueM);
      const feeValueT = div(mul(order.params.feeT, fillValueM), order.params.valueM);
      assert.equal(newBalances[maker][order.params.tokenM], sub(balances[maker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.params.tokenT], add(balances[maker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.params.tokenT], sub(balances[taker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.params.tokenM], add(balances[taker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should transfer the correct amounts when taker is specified and order is claimed by taker', async () => {
      order = await orderFactory.newSignedOrderAsync({
        taker,
        valueM: toSmallestUnits(100),
        valueT: toSmallestUnits(200),
      });

      const filledAmountMBefore = await exchange.fills.call(order.params.orderHashHex);
      assert.equal(filledAmountMBefore, 0, 'filledAmountMBefore should be 0');

      const fillValueM = div(order.params.valueM, 2);
      await exWrapper.fillAsync(order, { fillValueM, from: taker });

      const filledAmountMAfter = await exchange.fills.call(order.params.orderHashHex);
      const expectedFillAmountMAfter = add(fillValueM, filledAmountMBefore);
      assert.equal(filledAmountMAfter.toString(), expectedFillAmountMAfter, 'filledAmountMAfter should be same as fillValueM');

      const newBalances = await dmyBalances.getAsync();

      const fillValueT = div(mul(fillValueM, order.params.valueT), order.params.valueM);
      const feeValueM = div(mul(order.params.feeM, fillValueM), order.params.valueM);
      const feeValueT = div(mul(order.params.feeT, fillValueM), order.params.valueM);
      assert.equal(newBalances[maker][order.params.tokenM], sub(balances[maker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.params.tokenT], add(balances[maker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.params.tokenT], sub(balances[taker][order.params.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.params.tokenM], add(balances[taker][order.params.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should fill remaining value if fillValueM > remaining valueM', async () => {
      const fillValueM = div(order.params.valueM, 2);
      await exWrapper.fillAsync(order, { fillValueM, from: taker });

      const res = await exWrapper.fillAsync(order, { fillValueM: order.params.valueM, from: taker });

      assert.equal(res.logs[0].args.filledValueM.toString(), sub(order.params.valueM, fillValueM));
      const newBalances = await dmyBalances.getAsync();

      assert.equal(newBalances[maker][order.params.tokenM], sub(balances[maker][order.params.tokenM], order.params.valueM));
      assert.equal(newBalances[maker][order.params.tokenT], add(balances[maker][order.params.tokenT], order.params.valueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], order.params.feeM));
      assert.equal(newBalances[taker][order.params.tokenT], sub(balances[taker][order.params.tokenT], order.params.valueT));
      assert.equal(newBalances[taker][order.params.tokenM], add(balances[taker][order.params.tokenM], order.params.valueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], order.params.feeT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address],
                   add(order.params.feeM, order.params.feeT)));
    });

    it('should log 1 event', async () => {
      const res = await exWrapper.fillAsync(order, { fillValueM: div(order.params.valueM, 2), from: taker });
      assert.equal(res.logs.length, 1);
    });

    it('should throw when taker is specified and order is claimed by other', async () => {
      order = await orderFactory.newSignedOrderAsync({
        taker: feeRecipient,
        valueM: toSmallestUnits(100),
        valueT: toSmallestUnits(200),
      });

      try {
        await exWrapper.fillAsync(order, { from: taker });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if signature is invalid', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(10),
      });

      order.params.r = ethUtil.bufferToHex(ethUtil.sha3('invalidR'));
      order.params.s = ethUtil.bufferToHex(ethUtil.sha3('invalidS'));
      try {
        await exWrapper.fillAsync(order, { from: taker });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not change balances if balances are too low to fill order and shouldCheckTransfer = true', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(100000),
      });

      await exWrapper.fillAsync(order, { shouldCheckTransfer: true, from: taker });
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });


    it('should throw if balances are too low to fill order and shouldCheckTransfer = false', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(100000),
      });

      try {
        await exWrapper.fillAsync(order, { from: taker });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not change balances if allowances are too low to fill order and shouldCheckTransfer = true', async () => {
      await rep.approve(Proxy.address, 0, { from: maker });
      await exWrapper.fillAsync(order, { shouldCheckTransfer: true, from: taker });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if allowances are too low to fill order and shouldCheckTransfer = false', async () => {
      try {
        await exWrapper.fillAsync(order, { from: taker });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
        await rep.approve(Proxy.address, INIT_ALLOW, { from: maker });
      }
    });

    it('should not change balances if an order is expired', async () => {
      order = await orderFactory.newSignedOrderAsync({
        expiration: Math.floor((Date.now() - 10000) / 1000),
      });
      await exWrapper.fillAsync(order, { from: taker });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should not log events if an order is expired', async () => {
      order = await orderFactory.newSignedOrderAsync({
        expiration: Math.floor((Date.now() - 10000) / 1000),
      });

      const res = await exWrapper.fillAsync(order, { from: taker });
      assert.equal(res.logs.length, 0);
    });

    it('should not log events if no value is filled', async () => {
      await exWrapper.fillAsync(order, { from: taker });

      const res = await exWrapper.fillAsync(order, { from: taker });
      assert.equal(res.logs.length, 0);
    });
  });

  describe('cancel', () => {
    beforeEach(async () => {
      balances = await dmyBalances.getAsync();
      order = await orderFactory.newSignedOrderAsync();
    });

    it('should throw if not sent by maker', async () => {
      try {
        await exWrapper.cancelAsync(order, { from: taker });
        throw new Error('Cancel succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should be able to cancel a full order', async () => {
      await exWrapper.cancelAsync(order, { from: maker });
      await exWrapper.fillAsync(order, { fillValueM: div(order.params.valueM, 2), from: taker });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should be able to cancel part of an order', async () => {
      const cancelValueM = div(order.params.valueM, 2);
      await exWrapper.cancelAsync(order, { cancelValueM, from: maker });

      const res = await exWrapper.fillAsync(order, { fillValueM: order.params.valueM, from: taker });
      assert.equal(res.logs[0].args.filledValueM.toString(), sub(order.params.valueM, cancelValueM));

      const newBalances = await dmyBalances.getAsync();
      const cancelValueT = div(mul(cancelValueM, order.params.valueT), order.params.valueM);
      const feeValueM = div(mul(order.params.feeM, cancelValueM), order.params.valueM);
      const feeValueT = div(mul(order.params.feeT, cancelValueM), order.params.valueM);
      assert.equal(newBalances[maker][order.params.tokenM], sub(balances[maker][order.params.tokenM], cancelValueM));
      assert.equal(newBalances[maker][order.params.tokenT], add(balances[maker][order.params.tokenT], cancelValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.params.tokenT], sub(balances[taker][order.params.tokenT], cancelValueT));
      assert.equal(newBalances[taker][order.params.tokenM], add(balances[taker][order.params.tokenM], cancelValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should log 1 event', async () => {
      const res = await exWrapper.cancelAsync(order, { cancelValueM: div(order.params.valueM, 2), from: maker });
      assert.equal(res.logs.length, 1);
    });

    it('should not log events if no value is cancelled', async () => {
      await exWrapper.cancelAsync(order, { from: maker });

      const res = await exWrapper.cancelAsync(order, { from: maker });
      assert.equal(res.logs.length, 0);
    });

    it('should not log events if order is expired', async () => {
      order = await orderFactory.newSignedOrderAsync({
        expiration: Math.floor((Date.now() - 10000) / 1000),
      });

      const res = await exWrapper.cancelAsync(order, { from: maker });
      assert.equal(res.logs.length, 0);
    });
  });
});
