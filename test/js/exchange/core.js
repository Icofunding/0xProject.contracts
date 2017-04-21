require('babel-polyfill');
require('source-map-support/register');

const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyToken = artifacts.require('./tokens/DummyToken.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');

const assert = require('assert');
const util = require('../../../util/index.js')(web3);

const { add, sub, mul, div, toSmallestUnits } = util.BNutil;

contract('Exchange', accounts => {
  const maker = accounts[0];
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

  let exUtil;
  let getDmyBalances;
  let orderFactory;

  before(async () => {
    [tokenRegistry, exchange] = await Promise.all([
      TokenRegistry.deployed(),
      Exchange.deployed(),
    ]);
    const [repAddress, dgdAddress, zrxAddress] = await Promise.all([
      tokenRegistry.getTokenAddressBySymbol('REP'),
      tokenRegistry.getTokenAddressBySymbol('DGD'),
      tokenRegistry.getTokenAddressBySymbol('ZRX'),
    ]);
    orderFactory = util.createOrderFactory({
      exchange: Exchange.address,
      maker,
      feeRecipient,
      tokenM: repAddress,
      tokenT: dgdAddress,
      valueM: toSmallestUnits(100),
      valueT: toSmallestUnits(200),
      feeM: toSmallestUnits(1),
      feeT: toSmallestUnits(1),
    });
    [rep, dgd, zrx] = await Promise.all([
      DummyToken.at(repAddress),
      DummyToken.at(dgdAddress),
      DummyToken.at(zrxAddress),
    ]);

    exUtil = util.exchangeUtil(exchange);
    getDmyBalances = util.getBalancesFactory([rep, dgd, zrx], [maker, taker, feeRecipient]);
    await Promise.all([
      rep.approve(Proxy.address, INIT_ALLOW, { from: maker }),
      rep.approve(Proxy.address, INIT_ALLOW, { from: taker }),
      rep.setBalance(INIT_BAL, { from: maker }),
      rep.setBalance(INIT_BAL, { from: taker }),
      dgd.approve(Proxy.address, INIT_ALLOW, { from: maker }),
      dgd.approve(Proxy.address, INIT_ALLOW, { from: taker }),
      dgd.setBalance(INIT_BAL, { from: maker }),
      dgd.setBalance(INIT_BAL, { from: taker }),
      zrx.approve(Proxy.address, INIT_ALLOW, { from: maker }),
      zrx.approve(Proxy.address, INIT_ALLOW, { from: taker }),
      zrx.setBalance(INIT_BAL, { from: maker }),
      zrx.setBalance(INIT_BAL, { from: taker }),
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
      balances = await getDmyBalances();
      order = await util.createOrder(orderFactory());
    });

    it('should transfer the correct amounts when valueM === valueT', async () => {
      const orderParams = orderFactory({ valueM: toSmallestUnits(100), valueT: toSmallestUnits(100) });
      order = await util.createOrder(orderParams);

      const orderHash = util.getOrderHash(orderParams, { hex: true });
      const fillAmountMBefore = await exchange.fills.call(orderHash);
      assert.equal(fillAmountMBefore, 0, 'fillAmountMBefore should be 0');

      const fillValueM = div(order.valueM, 2);
      await exUtil.fill(order, { fillValueM, from: taker });

      const fillAmountMAfter = await exchange.fills.call(orderHash);
      assert.equal(fillAmountMAfter, fillValueM, 'fillAmountMAfter should be same as fillValueM');

      const newBalances = await getDmyBalances();
      const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
      const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
      const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
      assert.equal(newBalances[maker][order.tokenM], sub(balances[maker][order.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.tokenT], add(balances[maker][order.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.tokenT], sub(balances[taker][order.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.tokenM], add(balances[taker][order.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should transfer the correct amounts when valueM > valueT', async () => {
      order = await util.createOrder(orderFactory({ valueM: toSmallestUnits(200), valueT: toSmallestUnits(100) }));

      const fillValueM = div(order.valueM, 2);
      await exUtil.fill(order, { fillValueM, from: taker });

      const newBalances = await getDmyBalances();

      const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
      const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
      const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
      assert.equal(newBalances[maker][order.tokenM], sub(balances[maker][order.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.tokenT], add(balances[maker][order.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.tokenT], sub(balances[taker][order.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.tokenM], add(balances[taker][order.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should transfer the correct amounts when valueM < valueT', async () => {
      order = await util.createOrder(orderFactory({ valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) }));

      const fillValueM = div(order.valueM, 2);
      await exUtil.fill(order, { fillValueM, from: taker });

      const newBalances = await getDmyBalances();

      const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
      const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
      const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
      assert.equal(newBalances[maker][order.tokenM], sub(balances[maker][order.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.tokenT], add(balances[maker][order.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.tokenT], sub(balances[taker][order.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.tokenM], add(balances[taker][order.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should transfer the correct amounts when taker is specified and order is claimed by taker', async () => {
      order = await util.createOrder(orderFactory({ taker, valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) }));

      const fillValueM = div(order.valueM, 2);
      await exUtil.fill(order, { fillValueM, from: taker });

      const newBalances = await getDmyBalances();

      const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
      const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
      const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
      assert.equal(newBalances[maker][order.tokenM], sub(balances[maker][order.tokenM], fillValueM));
      assert.equal(newBalances[maker][order.tokenT], add(balances[maker][order.tokenT], fillValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.tokenT], sub(balances[taker][order.tokenT], fillValueT));
      assert.equal(newBalances[taker][order.tokenM], add(balances[taker][order.tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should fill remaining value if fillValueM > remaining valueM', async () => {
      const fillValueM = div(order.valueM, 2);
      await exUtil.fill(order, { fillValueM, from: taker });

      const res = await exUtil.fill(order, { fillValueM: order.valueM, from: taker });

      assert.equal(res.logs[0].args.filledValueM.toString(), sub(order.valueM, fillValueM));
      const newBalances = await getDmyBalances();

      assert.equal(newBalances[maker][order.tokenM], sub(balances[maker][order.tokenM], order.valueM));
      assert.equal(newBalances[maker][order.tokenT], add(balances[maker][order.tokenT], order.valueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], order.feeM));
      assert.equal(newBalances[taker][order.tokenT], sub(balances[taker][order.tokenT], order.valueT));
      assert.equal(newBalances[taker][order.tokenM], add(balances[taker][order.tokenM], order.valueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], order.feeT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(order.feeM, order.feeT)));
    });

    it('should log 1 event', async () => {
      const res = await exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker });
      assert.equal(res.logs.length, 1);
    });

    it('should throw when taker is specified and order is claimed by other', async () => {
      order = await util.createOrder(orderFactory({ taker: feeRecipient, valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) }));

      try {
        await exUtil.fill(order, { from: taker });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        util.test.assertThrow(err);
      }
    });

    it('should throw if signature is invalid', async () => {
      order = await util.createOrder(orderFactory({ valueM: toSmallestUnits(10) }));

      order.r = util.sha3('invalidR');
      order.s = util.sha3('invalidS');
      try {
        await exUtil.fill(order, { from: taker });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        util.test.assertThrow(err);
      }
    });

    it('should not change balances if balances are too low to fill order and shouldCheckTransfer = true', async () => {
      order = await util.createOrder(orderFactory({ valueM: toSmallestUnits(100000) }));

      await exUtil.fill(order, { shouldCheckTransfer: true, from: taker });
      const newBalances = await getDmyBalances();
      expect(newBalances).to.deep.equal(balances);
    });


    it('should throw if balances are too low to fill order and shouldCheckTransfer = false', async () => {
      order = await util.createOrder(orderFactory({ valueM: toSmallestUnits(100000) }));

      try {
        await exUtil.fill(order, { from: taker });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        util.test.assertThrow(err);
      }
    });

    it('should not change balances if allowances are too low to fill order and shouldCheckTransfer = true', async () => {
      await rep.approve(Proxy.address, 0, { from: maker });
      await exUtil.fill(order, { shouldCheckTransfer: true, from: taker });

      const newBalances = await getDmyBalances();
      expect(newBalances).to.deep.equal(balances);
    });

    it('should throw if allowances are too low to fill order and shouldCheckTransfer = false', async () => {
      try {
        await exUtil.fill(order, { from: taker });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        util.test.assertThrow(err);
        await rep.approve(Proxy.address, INIT_ALLOW, { from: maker });
      }
    });

    it('should not change balances if an order is expired', async () => {
      order = await util.createOrder(orderFactory({ expiration: Math.floor((Date.now() - 10000) / 1000) }));
      await exUtil.fill(order, { from: taker });

      const newBalances = await getDmyBalances();
      expect(newBalances).to.deep.equal(balances);
    });

    it('should not log events if an order is expired', async () => {
      order = await util.createOrder(orderFactory({ expiration: Math.floor((Date.now() - 10000) / 1000) }));

      const res = await exUtil.fill(order, { from: taker });
      assert.equal(res.logs.length, 0);
    });

    it('should not log events if no value is filled', async () => {
      await exUtil.fill(order, { from: taker });

      const res = await exUtil.fill(order, { from: taker });
      assert.equal(res.logs.length, 0);
    });
  });

  describe('cancel', () => {
    beforeEach(async () => {
      balances = await getDmyBalances();
      order = await util.createOrder(orderFactory());
    });

    it('should throw if not sent by maker', async () => {
      try {
        await exUtil.cancel(order, { from: taker });
        throw new Error('Cancel succeeded when it should have thrown');
      } catch (err) {
        util.test.assertThrow(err);
      }
    });

    it('should be able to cancel a full order', async () => {
      await exUtil.cancel(order, { from: maker });
      await exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker });

      const newBalances = await getDmyBalances();
      expect(newBalances).to.deep.equal(balances);
    });

    it('should be able to cancel part of an order', async () => {
      const cancelValueM = div(order.valueM, 2);
      await exUtil.cancel(order, { cancelValueM, from: maker });

      const res = await exUtil.fill(order, { fillValueM: order.valueM, from: taker });
      assert.equal(res.logs[0].args.filledValueM.toString(), sub(order.valueM, cancelValueM));

      const newBalances = await getDmyBalances();
      const cancelValueT = div(mul(cancelValueM, order.valueT), order.valueM);
      const feeValueM = div(mul(order.feeM, cancelValueM), order.valueM);
      const feeValueT = div(mul(order.feeT, cancelValueM), order.valueM);
      assert.equal(newBalances[maker][order.tokenM], sub(balances[maker][order.tokenM], cancelValueM));
      assert.equal(newBalances[maker][order.tokenT], add(balances[maker][order.tokenT], cancelValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.tokenT], sub(balances[taker][order.tokenT], cancelValueT));
      assert.equal(newBalances[taker][order.tokenM], add(balances[taker][order.tokenM], cancelValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should log 1 event', async () => {
      const res = await exUtil.cancel(order, { cancelValueM: div(order.valueM, 2), from: maker });
      assert.equal(res.logs.length, 1);
    });

    it('should not log events if no value is cancelled', async () => {
      await exUtil.cancel(order, { from: maker });

      const res = await exUtil.cancel(order, { from: maker });
      assert.equal(res.logs.length, 0);
    });

    it('should not log events if order is expired', async () => {
      order = await util.createOrder(orderFactory({ expiration: Math.floor((Date.now() - 10000) / 1000) }));

      const res = await exUtil.cancel(order, { from: maker });
      assert.equal(res.logs.length, 0);
    });
  });
});
