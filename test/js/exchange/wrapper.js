const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyToken = artifacts.require('./tokens/DummyToken.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');

const assert = require('assert');
const util = require('../../../util/index.js')(web3);

const { add, sub, mul, div, toSmallestUnits } = util.BNutil;

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
      balances = await getDmyBalances();
    });

    it('should transfer the correct amounts', async () => {
      const order = await util.createOrder(orderFactory({ valueM: toSmallestUnits(100), valueT: toSmallestUnits(200) }));
      const fillValueM = div(order.valueM, 2);
      await exUtil.fillOrKill(order, { fillValueM, from: taker });

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

    it('should throw if an order is expired', async () => {
      const order = await util.createOrder(orderFactory({ expiration: Math.floor((Date.now() - 10000) / 1000) }));

      try {
        await exUtil.fillOrKill(order, { from: taker });
        throw new Error('FillOrKill succeeded when it should have thrown');
      } catch (err) {
        util.test.assertThrow(err);
      }
    });

    it('should throw if entire fillValueM not filled', async () => {
      const order = await util.createOrder(orderFactory());

      await exUtil.fill(order, { fillValueM: div(order.valueM, 2), from: taker });

      try {
        await exUtil.fillOrKill(order, { from: taker });
        throw new Error('FillOrKill succeeded when it should have thrown');
      } catch (err) {
        util.test.assertThrow(err);
      }
    });
  });

  describe('batchFill', () => {
    let orders;
    beforeEach(async () => {
      orders = await Promise.all([
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
      ]);
      balances = await getDmyBalances();
    });

    it('should transfer the correct amounts', async () => {
      const fillValuesM = [];
      const tokenM = rep.address;
      const tokenT = dgd.address;
      orders.forEach(order => {
        const fillValueM = div(order.valueM, 2);
        const fillValueT = div(mul(fillValueM, order.valueT), order.valueM);
        const feeValueM = div(mul(order.feeM, fillValueM), order.valueM);
        const feeValueT = div(mul(order.feeT, fillValueM), order.valueM);
        fillValuesM.push(fillValueM);
        balances[maker][tokenM] = sub(balances[maker][tokenM], fillValueM);
        balances[maker][tokenT] = add(balances[maker][tokenT], fillValueT);
        balances[maker][zrx.address] = sub(balances[maker][zrx.address], feeValueM);
        balances[taker][tokenM] = add(balances[taker][tokenM], fillValueM);
        balances[taker][tokenT] = sub(balances[taker][tokenT], fillValueT);
        balances[taker][zrx.address] = sub(balances[taker][zrx.address], feeValueT);
        balances[feeRecipient][zrx.address] = add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT));
      });

      await exUtil.batchFill(orders, { fillValuesM, from: taker });

      const newBalances = await getDmyBalances();
      assert.deepEqual(newBalances, balances);
    });
  });

  describe('fillUpTo', () => {
    let orders;
    beforeEach(async () => {
      orders = await Promise.all([
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
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
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][orders[0].tokenT], sub(balances[taker][orders[0].tokenT], fillValueT));
      assert.equal(newBalances[taker][orders[0].tokenM], add(balances[taker][orders[0].tokenM], fillValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should fill all orders if cannot fill entire fillValueM', async () => {
      const fillValueM = toSmallestUnits(100000);
      orders.forEach(order => {
        balances[maker][order.tokenM] = sub(balances[maker][order.tokenM], order.valueM);
        balances[maker][order.tokenT] = add(balances[maker][order.tokenT], order.valueT);
        balances[maker][zrx.address] = sub(balances[maker][zrx.address], order.feeM);
        balances[taker][order.tokenM] = add(balances[taker][order.tokenM], order.valueM);
        balances[taker][order.tokenT] = sub(balances[taker][order.tokenT], order.valueT);
        balances[taker][zrx.address] = sub(balances[taker][zrx.address], order.feeT);
        balances[feeRecipient][zrx.address] = add(balances[feeRecipient][zrx.address], add(order.feeM, order.feeT));
      });
      await exUtil.fillUpTo(orders, { fillValueM, from: taker });

      const newBalances = await getDmyBalances();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw when an order does not use the same tokenM', async () => {
      orders = await Promise.all([
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory({ tokenM: zrx.address })),
        util.createOrder(orderFactory()),
      ]);

      try {
        await exUtil.fillUpTo(orders, { fillValueM: toSmallestUnits(1000), from: taker });
        throw new Error('FillUpTo succeeded when it should have thrown');
      } catch (err) {
        util.test.assertThrow(err);
      }
    });
  });

  describe('batchCancel', () => {
    it('should be able to cancel multiple orders', async () => {
      const orders = await Promise.all([
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
        util.createOrder(orderFactory()),
      ]);
      const cancelValuesM = orders.map(order => order.valueM);
      await exUtil.batchCancel(orders, { cancelValuesM, from: maker });

      const res = await exUtil.batchFill(orders, { fillValuesM: cancelValuesM, from: taker });
      assert.equal(res.logs.length, 0);
    });
  });
});
