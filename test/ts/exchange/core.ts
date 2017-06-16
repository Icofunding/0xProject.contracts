import * as assert from 'assert';
import ethUtil = require('ethereumjs-util');
import * as BigNumber from 'bignumber.js';
import { constants } from '../../../util/constants';
import { Balances } from '../../../util/balances';
import { BNUtil } from '../../../util/bn_util';
import { crypto } from '../../../util/crypto';
import { ExchangeWrapper } from '../../../util/exchange_wrapper';
import { OrderFactory } from '../../../util/order_factory';
import { testUtil } from '../../../util/test_util';
import { Order } from '../../../util/order';
import { BalancesByOwner, ContractInstance, ExchangeContractErrs } from '../../../util/types';
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

  let order: Order;
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

  describe('internal functions', () => {
    it('should include transferViaProxy', () => {
      assert.equal(exchange.transferViaProxy, undefined);
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

      const filledAmountTBefore = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledAmountTBefore, 0, 'filledAmountMBefore should be 0');

      const fillValueT = order.params.valueT.div(2);
      await exWrapper.fillAsync(order, taker, { fillValueT });

      const filledAmountTAfter = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledAmountTAfter, fillValueT.toString(), 'filledAmountTAfter should be same as fillValueT');

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

    it('should transfer the correct amounts when valueM > valueT', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(200),
        valueT: toSmallestUnits(100),
      });

      const filledAmountTBefore = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledAmountTBefore, 0, 'filledAmountTBefore should be 0');

      const fillValueT = order.params.valueT.div(2);
      await exWrapper.fillAsync(order, taker, { fillValueT });

      const filledAmountTAfter = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledAmountTAfter, fillValueT.toString(), 'filledAmountTAfter should be same as fillValueT');

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

    it('should transfer the correct amounts when valueM < valueT', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(100),
        valueT: toSmallestUnits(200),
      });

      const filledAmountTBefore = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledAmountTBefore, 0, 'filledAmountTBefore should be 0');

      const fillValueT = order.params.valueT.div(2);
      await exWrapper.fillAsync(order, taker, { fillValueT });

      const filledAmountTAfter = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledAmountTAfter, fillValueT.toString(), 'filledAmountTAfter should be same as fillValueT');

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

    it('should transfer the correct amounts when taker is specified and order is claimed by taker', async () => {
      order = await orderFactory.newSignedOrderAsync({
        taker,
        valueM: toSmallestUnits(100),
        valueT: toSmallestUnits(200),
      });

      const filledAmountTBefore = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledAmountTBefore, 0, 'filledAmountTBefore should be 0');

      const fillValueT = order.params.valueT.div(2);
      await exWrapper.fillAsync(order, taker, { fillValueT });

      const filledAmountTAfter = await exchange.filled.call(order.params.orderHashHex);
      const expectedFillAmountTAfter = add(fillValueT, filledAmountTBefore);
      assert.equal(filledAmountTAfter.toString(), expectedFillAmountTAfter,
                   'filledAmountTAfter should be same as fillValueT');

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

    it('should fill remaining value if fillValueT > remaining valueT', async () => {
      const fillValueT = order.params.valueT.div(2);
      await exWrapper.fillAsync(order, taker, { fillValueT });

      const res = await exWrapper.fillAsync(order, taker, { fillValueT: order.params.valueT });

      assert.equal(res.logs[0].args.filledValueT.toString(), sub(order.params.valueT, fillValueT));
      const newBalances = await dmyBalances.getAsync();

      assert.equal(newBalances[maker][order.params.tokenM],
                   sub(balances[maker][order.params.tokenM], order.params.valueM));
      assert.equal(newBalances[maker][order.params.tokenT],
                   add(balances[maker][order.params.tokenT], order.params.valueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], order.params.feeM));
      assert.equal(newBalances[taker][order.params.tokenT],
                   sub(balances[taker][order.params.tokenT], order.params.valueT));
      assert.equal(newBalances[taker][order.params.tokenM],
                   add(balances[taker][order.params.tokenM], order.params.valueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], order.params.feeT));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address],
                   add(order.params.feeM, order.params.feeT)));
    });

    it('should log 1 event with the correct arguments when order has a feeRecipient', async () => {
      const divisor = 2;
      const res = await exWrapper.fillAsync(order, taker, { fillValueT: order.params.valueT.div(divisor) });
      assert.equal(res.logs.length, 1);

      const logArgs = res.logs[0].args;
      const expectedFilledValueM = order.params.valueM.div(divisor);
      const expectedFilledValueT = order.params.valueT.div(divisor);
      const expectedFeeMPaid = order.params.feeM.div(divisor);
      const expectedFeeTPaid = order.params.feeT.div(divisor);
      const tokensHashBuff = crypto.solSHA3([order.params.tokenM, order.params.tokenT]);
      const expectedTokens = ethUtil.bufferToHex(tokensHashBuff);

      assert.equal(order.params.maker, logArgs.maker);
      assert.equal(taker, logArgs.taker);
      assert.equal(order.params.feeRecipient, logArgs.feeRecipient);
      assert.equal(order.params.tokenM, logArgs.tokenM);
      assert.equal(order.params.tokenT, logArgs.tokenT);
      assert.equal(expectedFilledValueM.toString(), logArgs.filledValueM.toString());
      assert.equal(expectedFilledValueT.toString(), logArgs.filledValueT.toString());
      assert.equal(expectedFeeMPaid.toString(), logArgs.feeMPaid.toString());
      assert.equal(expectedFeeTPaid.toString(), logArgs.feeTPaid.toString());
      assert.equal(expectedTokens, logArgs.tokens);
      assert.equal(order.params.orderHashHex, logArgs.orderHash);
    });

    it('should log 1 event with the correct arguments when order has no feeRecipient', async () => {
      order = await orderFactory.newSignedOrderAsync({
        feeRecipient: constants.NULL_ADDRESS,
      });
      const divisor = 2;
      const res = await exWrapper.fillAsync(order, taker, { fillValueT: order.params.valueT.div(divisor) });
      assert.equal(res.logs.length, 1);

      const logArgs = res.logs[0].args;
      const expectedFilledValueM = order.params.valueM.div(divisor);
      const expectedFilledValueT = order.params.valueT.div(divisor);
      const expectedFeeMPaid = new BigNumber(0);
      const expectedFeeTPaid = new BigNumber(0);
      const tokensHashBuff = crypto.solSHA3([order.params.tokenM, order.params.tokenT]);
      const expectedTokens = ethUtil.bufferToHex(tokensHashBuff);

      assert.equal(order.params.maker, logArgs.maker);
      assert.equal(taker, logArgs.taker);
      assert.equal(order.params.feeRecipient, logArgs.feeRecipient);
      assert.equal(order.params.tokenM, logArgs.tokenM);
      assert.equal(order.params.tokenT, logArgs.tokenT);
      assert.equal(expectedFilledValueM.toString(), logArgs.filledValueM.toString());
      assert.equal(expectedFilledValueT.toString(), logArgs.filledValueT.toString());
      assert.equal(expectedFeeMPaid.toString(), logArgs.feeMPaid.toString());
      assert.equal(expectedFeeTPaid.toString(), logArgs.feeTPaid.toString());
      assert.equal(expectedTokens, logArgs.tokens);
      assert.equal(order.params.orderHashHex, logArgs.orderHash);
    });

    it('should throw when taker is specified and order is claimed by other', async () => {
      order = await orderFactory.newSignedOrderAsync({
        taker: feeRecipient,
        valueM: toSmallestUnits(100),
        valueT: toSmallestUnits(200),
      });

      try {
        await exWrapper.fillAsync(order, taker);
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
        await exWrapper.fillAsync(order, taker);
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not change balances if maker balances are too low to fill order and shouldCheckTransfer = true',
       async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(100000),
      });

      await exWrapper.fillAsync(order, taker, { shouldCheckTransfer: true });
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if maker balances are too low to fill order and shouldCheckTransfer = false', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueM: toSmallestUnits(100000),
      });

      try {
        await exWrapper.fillAsync(order, taker);
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not change balances if taker balances are too low to fill order and shouldCheckTransfer = true',
       async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueT: toSmallestUnits(100000),
      });

      await exWrapper.fillAsync(order, taker, { shouldCheckTransfer: true });
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if taker balances are too low to fill order and shouldCheckTransfer = false', async () => {
      order = await orderFactory.newSignedOrderAsync({
        valueT: toSmallestUnits(100000),
      });

      try {
        await exWrapper.fillAsync(order, taker);
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not change balances if maker allowances are too low to fill order and shouldCheckTransfer = true',
       async () => {
      await rep.approve(Proxy.address, 0, { from: maker });
      await exWrapper.fillAsync(order, taker, { shouldCheckTransfer: true });
      await rep.approve(Proxy.address, INIT_ALLOW, { from: maker });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if maker allowances are too low to fill order and shouldCheckTransfer = false', async () => {
      try {
        await rep.approve(Proxy.address, 0, { from: maker });
        await exWrapper.fillAsync(order, taker);
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
        await rep.approve(Proxy.address, INIT_ALLOW, { from: maker });
      }
    });

    it('should not change balances if taker allowances are too low to fill order and shouldCheckTransfer = true',
       async () => {
      await dgd.approve(Proxy.address, 0, { from: taker });
      await exWrapper.fillAsync(order, taker, { shouldCheckTransfer: true });
      await dgd.approve(Proxy.address, INIT_ALLOW, { from: taker });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should not change balances if tokenM is ZRX, valueM + feeM > maker balance, and shouldCheckTransfer = true',
       async () => {
      const makerZRXBalance = new BigNumber(balances[maker][zrx.address]);
      order = await orderFactory.newSignedOrderAsync({
        tokenM: zrx.address,
        valueM: makerZRXBalance,
        feeM: new BigNumber(1),
      });
      await exWrapper.fillAsync(order, taker, { shouldCheckTransfer: true });
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should not change balances if tokenM is ZRX, valueM + feeM > maker allowance, and shouldCheckTransfer = true',
       async () => {
      const makerZRXAllowance = await zrx.allowance(maker, Proxy.address);
      const makerZRXAllowanceFixed = makerZRXAllowance.toFixed(); // remove scientific notation
      order = await orderFactory.newSignedOrderAsync({
        tokenM: zrx.address,
        valueM: new BigNumber(makerZRXAllowanceFixed),
        feeM: new BigNumber(1),
      });
      await exWrapper.fillAsync(order, taker, { shouldCheckTransfer: true });
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should not change balances if tokenT is ZRX, valueT + feeT > taker balance, and shouldCheckTransfer = true',
       async () => {
      const takerZRXBalance = new BigNumber(balances[taker][zrx.address]);
      order = await orderFactory.newSignedOrderAsync({
        tokenT: zrx.address,
        valueT: takerZRXBalance,
        feeT: new BigNumber(1),
      });
      await exWrapper.fillAsync(order, taker, { shouldCheckTransfer: true });
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should not change balances if tokenT is ZRX, valueT + feeT > taker allowance, and shouldCheckTransfer = true',
       async () => {
      const takerZRXAllowance = await zrx.allowance(taker, Proxy.address);
      const takerZRXAllowanceFixed = takerZRXAllowance.toFixed(); // remove scientific notation
      order = await orderFactory.newSignedOrderAsync({
        tokenT: zrx.address,
        valueT: new BigNumber(takerZRXAllowanceFixed),
        feeT: new BigNumber(1),
      });
      await exWrapper.fillAsync(order, taker, { shouldCheckTransfer: true });
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if taker allowances are too low to fill order and shouldCheckTransfer = false', async () => {
      try {
        await dgd.approve(Proxy.address, 0, { from: taker });
        await exWrapper.fillAsync(order, taker);
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
        await dgd.approve(Proxy.address, INIT_ALLOW, { from: taker });
      }
    });

    it('should not change balances if an order is expired', async () => {
      order = await orderFactory.newSignedOrderAsync({
        expiration: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
      });
      await exWrapper.fillAsync(order, taker);

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should log an error event if an order is expired', async () => {
      order = await orderFactory.newSignedOrderAsync({
        expiration: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
      });

      const res = await exWrapper.fillAsync(order, taker);
      assert.equal(res.logs.length, 1);
      const errCode = res.logs[0].args.errorId.toNumber();
      assert.equal(errCode, ExchangeContractErrs.ERROR_FILL_EXPIRED);
    });

    it('should log an error event if no value is filled', async () => {
      await exWrapper.fillAsync(order, taker);

      const res = await exWrapper.fillAsync(order, taker);
      assert.equal(res.logs.length, 1);
      const errCode = res.logs[0].args.errorId.toNumber();
      assert.equal(errCode, ExchangeContractErrs.ERROR_FILL_NO_VALUE);
    });
  });

  describe('cancel', () => {
    beforeEach(async () => {
      balances = await dmyBalances.getAsync();
      order = await orderFactory.newSignedOrderAsync();
    });

    it('should throw if not sent by maker', async () => {
      try {
        await exWrapper.cancelAsync(order, taker);
        throw new Error('Cancel succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should be able to cancel a full order', async () => {
      await exWrapper.cancelAsync(order, maker);
      await exWrapper.fillAsync(order, taker, { fillValueT: order.params.valueT.div(2) });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should be able to cancel part of an order', async () => {
      const cancelValueT = order.params.valueT.div(2);
      await exWrapper.cancelAsync(order, maker, { cancelValueT });

      const res = await exWrapper.fillAsync(order, taker, { fillValueT: order.params.valueT });
      assert.equal(res.logs[0].args.filledValueT.toString(), sub(order.params.valueT, cancelValueT));

      const newBalances = await dmyBalances.getAsync();
      const cancelValueM = div(mul(cancelValueT, order.params.valueM), order.params.valueT);
      const feeValueM = div(mul(order.params.feeM, cancelValueM), order.params.valueM);
      const feeValueT = div(mul(order.params.feeT, cancelValueM), order.params.valueM);
      assert.equal(newBalances[maker][order.params.tokenM], sub(balances[maker][order.params.tokenM], cancelValueM));
      assert.equal(newBalances[maker][order.params.tokenT], add(balances[maker][order.params.tokenT], cancelValueT));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], feeValueM));
      assert.equal(newBalances[taker][order.params.tokenT], sub(balances[taker][order.params.tokenT], cancelValueT));
      assert.equal(newBalances[taker][order.params.tokenM], add(balances[taker][order.params.tokenM], cancelValueM));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], feeValueT));
      assert.equal(newBalances[feeRecipient][zrx.address],
                   add(balances[feeRecipient][zrx.address], add(feeValueM, feeValueT)));
    });

    it('should log 1 event with correct arguments', async () => {
      const divisor = 2;
      const res = await exWrapper.cancelAsync(order, maker, { cancelValueT: order.params.valueT.div(divisor) });
      assert.equal(res.logs.length, 1);

      const logArgs = res.logs[0].args;
      const expectedCancelledValueM = order.params.valueM.div(divisor);
      const expectedCancelledValueT = order.params.valueT.div(divisor);
      const tokensHashBuff = crypto.solSHA3([order.params.tokenM, order.params.tokenT]);
      const expectedTokens = ethUtil.bufferToHex(tokensHashBuff);

      assert.equal(order.params.maker, logArgs.maker);
      assert.equal(order.params.feeRecipient, logArgs.feeRecipient);
      assert.equal(order.params.tokenM, logArgs.tokenM);
      assert.equal(order.params.tokenT, logArgs.tokenT);
      assert.equal(expectedCancelledValueM.toString(), logArgs.cancelledValueM.toString());
      assert.equal(expectedCancelledValueT.toString(), logArgs.cancelledValueT.toString());
      assert.equal(expectedTokens, logArgs.tokens);
      assert.equal(order.params.orderHashHex, logArgs.orderHash);
    });

    it('should not log events if no value is cancelled', async () => {
      await exWrapper.cancelAsync(order, maker);

      const res = await exWrapper.cancelAsync(order, maker);
      assert.equal(res.logs.length, 1);
      const errId = res.logs[0].args.errorId.toNumber();
      const errCode = res.logs[0].args.errorId.toNumber();
      assert.equal(errCode, ExchangeContractErrs.ERROR_CANCEL_NO_VALUE);
    });

    it('should not log events if order is expired', async () => {
      order = await orderFactory.newSignedOrderAsync({
        expiration: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
      });

      const res = await exWrapper.cancelAsync(order, maker);
      assert.equal(res.logs.length, 1);
      const errCode = res.logs[0].args.errorId.toNumber();
      assert.equal(errCode, ExchangeContractErrs.ERROR_CANCEL_EXPIRED);
    });
  });
});
