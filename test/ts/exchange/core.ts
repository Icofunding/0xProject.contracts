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
  TokenProxy,
  DummyToken,
  TokenRegistry,
  MaliciousToken,
} = new Artifacts(artifacts);

const { add, sub, mul, div, toSmallestUnits } = BNUtil;

contract('Exchange', (accounts: string[]) => {
  const maker = accounts[0];
  const tokenOwner = accounts[0];
  const taker = accounts[1] || accounts[accounts.length - 1];
  const feeRecipient = accounts[2] || accounts[accounts.length - 1];

  const INITIAL_BALANCE = toSmallestUnits(10000);
  const INITIAL_ALLOWANCE = toSmallestUnits(10000);

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
      rep.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: maker }),
      rep.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: taker }),
      rep.setBalance(maker, INITIAL_BALANCE, { from: tokenOwner }),
      rep.setBalance(taker, INITIAL_BALANCE, { from: tokenOwner }),
      dgd.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: maker }),
      dgd.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: taker }),
      dgd.setBalance(maker, INITIAL_BALANCE, { from: tokenOwner }),
      dgd.setBalance(taker, INITIAL_BALANCE, { from: tokenOwner }),
      zrx.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: maker }),
      zrx.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: taker }),
      zrx.setBalance(maker, INITIAL_BALANCE, { from: tokenOwner }),
      zrx.setBalance(taker, INITIAL_BALANCE, { from: tokenOwner }),
    ]);
  });

  describe('internal functions', () => {
    it('should include transferViaTokenProxy', () => {
      assert.equal(exchange.transferViaTokenProxy, undefined);
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

  describe('fillOrder', () => {
    beforeEach(async () => {
      balances = await dmyBalances.getAsync();
      order = await orderFactory.newSignedOrderAsync();
    });

    it('should transfer the correct amounts when makerTokenAmount === takerTokenAmount', async () => {
      order = await orderFactory.newSignedOrderAsync({
        makerTokenAmount: toSmallestUnits(100),
        takerTokenAmount: toSmallestUnits(100),
      });

      const filledTakerTokenAmountBefore = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledTakerTokenAmountBefore, 0, 'filledAmountMBefore should be 0');

      const fillTakerTokenAmount = order.params.takerTokenAmount.div(2);
      await exWrapper.fillOrderAsync(order, taker, { fillTakerTokenAmount });

      const filledTakerTokenAmountAfter = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledTakerTokenAmountAfter, fillTakerTokenAmount.toString(),
                   'filledTakerTokenAmountAfter should be same as fillTakerTokenAmount');

      const newBalances = await dmyBalances.getAsync();

      const fillMakerTokenAmount = div(mul(fillTakerTokenAmount, order.params.makerTokenAmount),
                                       order.params.takerTokenAmount);
      const paidMakerFee = div(mul(order.params.makerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      const paidTakerFee = div(mul(order.params.takerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      assert.equal(newBalances[maker][order.params.makerToken],
                   sub(balances[maker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[maker][order.params.takerToken],
                   add(balances[maker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], paidMakerFee));
      assert.equal(newBalances[taker][order.params.takerToken],
                   sub(balances[taker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[taker][order.params.makerToken],
                   add(balances[taker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], paidTakerFee));
      assert.equal(newBalances[feeRecipient][zrx.address],
                   add(balances[feeRecipient][zrx.address], add(paidMakerFee, paidTakerFee)));
    });

    it('should transfer the correct amounts when makerTokenAmount > takerTokenAmount', async () => {
      order = await orderFactory.newSignedOrderAsync({
        makerTokenAmount: toSmallestUnits(200),
        takerTokenAmount: toSmallestUnits(100),
      });

      const filledTakerTokenAmountBefore = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledTakerTokenAmountBefore, 0, 'filledTakerTokenAmountBefore should be 0');

      const fillTakerTokenAmount = order.params.takerTokenAmount.div(2);
      await exWrapper.fillOrderAsync(order, taker, { fillTakerTokenAmount });

      const filledTakerTokenAmountAfter = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledTakerTokenAmountAfter, fillTakerTokenAmount.toString(),
                   'filledTakerTokenAmountAfter should be same as fillTakerTokenAmount');

      const newBalances = await dmyBalances.getAsync();

      const fillMakerTokenAmount = div(mul(fillTakerTokenAmount, order.params.makerTokenAmount),
                                       order.params.takerTokenAmount);
      const paidMakerFee = div(mul(order.params.makerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      const paidTakerFee = div(mul(order.params.takerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      assert.equal(newBalances[maker][order.params.makerToken],
                   sub(balances[maker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[maker][order.params.takerToken],
                   add(balances[maker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], paidMakerFee));
      assert.equal(newBalances[taker][order.params.takerToken],
                   sub(balances[taker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[taker][order.params.makerToken],
                   add(balances[taker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], paidTakerFee));
      assert.equal(newBalances[feeRecipient][zrx.address],
                   add(balances[feeRecipient][zrx.address], add(paidMakerFee, paidTakerFee)));
    });

    it('should transfer the correct amounts when makerTokenAmount < takerTokenAmount', async () => {
      order = await orderFactory.newSignedOrderAsync({
        makerTokenAmount: toSmallestUnits(100),
        takerTokenAmount: toSmallestUnits(200),
      });

      const filledTakerTokenAmountBefore = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledTakerTokenAmountBefore, 0, 'filledTakerTokenAmountBefore should be 0');

      const fillTakerTokenAmount = order.params.takerTokenAmount.div(2);
      await exWrapper.fillOrderAsync(order, taker, { fillTakerTokenAmount });

      const filledTakerTokenAmountAfter = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledTakerTokenAmountAfter, fillTakerTokenAmount.toString(),
                   'filledTakerTokenAmountAfter should be same as fillTakerTokenAmount');

      const newBalances = await dmyBalances.getAsync();

      const fillMakerTokenAmount = div(mul(fillTakerTokenAmount, order.params.makerTokenAmount),
                                       order.params.takerTokenAmount);
      const paidMakerFee = div(mul(order.params.makerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      const paidTakerFee = div(mul(order.params.takerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      assert.equal(newBalances[maker][order.params.makerToken],
                   sub(balances[maker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[maker][order.params.takerToken],
                   add(balances[maker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], paidMakerFee));
      assert.equal(newBalances[taker][order.params.takerToken],
                   sub(balances[taker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[taker][order.params.makerToken],
                   add(balances[taker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], paidTakerFee));
      assert.equal(newBalances[feeRecipient][zrx.address],
                   add(balances[feeRecipient][zrx.address], add(paidMakerFee, paidTakerFee)));
    });

    it('should transfer the correct amounts when taker is specified and order is claimed by taker', async () => {
      order = await orderFactory.newSignedOrderAsync({
        taker,
        makerTokenAmount: toSmallestUnits(100),
        takerTokenAmount: toSmallestUnits(200),
      });

      const filledTakerTokenAmountBefore = await exchange.filled.call(order.params.orderHashHex);
      assert.equal(filledTakerTokenAmountBefore, 0, 'filledTakerTokenAmountBefore should be 0');

      const fillTakerTokenAmount = order.params.takerTokenAmount.div(2);
      await exWrapper.fillOrderAsync(order, taker, { fillTakerTokenAmount });

      const filledTakerTokenAmountAfter = await exchange.filled.call(order.params.orderHashHex);
      const expectedFillAmountTAfter = add(fillTakerTokenAmount, filledTakerTokenAmountBefore);
      assert.equal(filledTakerTokenAmountAfter.toString(), expectedFillAmountTAfter,
                   'filledTakerTokenAmountAfter should be same as fillTakerTokenAmount');

      const newBalances = await dmyBalances.getAsync();

      const fillMakerTokenAmount = div(mul(fillTakerTokenAmount, order.params.makerTokenAmount),
                                       order.params.takerTokenAmount);
      const paidMakerFee = div(mul(order.params.makerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      const paidTakerFee = div(mul(order.params.takerFee, fillMakerTokenAmount), order.params.makerTokenAmount);
      assert.equal(newBalances[maker][order.params.makerToken],
                   sub(balances[maker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[maker][order.params.takerToken],
                   add(balances[maker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], paidMakerFee));
      assert.equal(newBalances[taker][order.params.takerToken],
                   sub(balances[taker][order.params.takerToken], fillTakerTokenAmount));
      assert.equal(newBalances[taker][order.params.makerToken],
                   add(balances[taker][order.params.makerToken], fillMakerTokenAmount));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], paidTakerFee));
      assert.equal(newBalances[feeRecipient][zrx.address],
                   add(balances[feeRecipient][zrx.address], add(paidMakerFee, paidTakerFee)));
    });

    it('should fill remaining value if fillTakerTokenAmount > remaining takerTokenAmount', async () => {
      const fillTakerTokenAmount = order.params.takerTokenAmount.div(2);
      await exWrapper.fillOrderAsync(order, taker, { fillTakerTokenAmount });

      const res = await exWrapper.fillOrderAsync(order, taker, { fillTakerTokenAmount: order.params.takerTokenAmount });

      assert.equal(res.logs[0].args.filledTakerTokenAmount.toString(),
                   sub(order.params.takerTokenAmount, fillTakerTokenAmount));
      const newBalances = await dmyBalances.getAsync();

      assert.equal(newBalances[maker][order.params.makerToken],
                   sub(balances[maker][order.params.makerToken], order.params.makerTokenAmount));
      assert.equal(newBalances[maker][order.params.takerToken],
                   add(balances[maker][order.params.takerToken], order.params.takerTokenAmount));
      assert.equal(newBalances[maker][zrx.address], sub(balances[maker][zrx.address], order.params.makerFee));
      assert.equal(newBalances[taker][order.params.takerToken],
                   sub(balances[taker][order.params.takerToken], order.params.takerTokenAmount));
      assert.equal(newBalances[taker][order.params.makerToken],
                   add(balances[taker][order.params.makerToken], order.params.makerTokenAmount));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], order.params.takerFee));
      assert.equal(newBalances[feeRecipient][zrx.address], add(balances[feeRecipient][zrx.address],
                   add(order.params.makerFee, order.params.takerFee)));
    });

    it('should log 1 event with the correct arguments when order has a feeRecipient', async () => {
      const divisor = 2;
      const res = await exWrapper.fillOrderAsync(order, taker,
                                            { fillTakerTokenAmount: order.params.takerTokenAmount.div(divisor) });
      assert.equal(res.logs.length, 1);

      const logArgs = res.logs[0].args;
      const expectedFilledMakerTokenAmount = order.params.makerTokenAmount.div(divisor);
      const expectedFilledTakerTokenAmount = order.params.takerTokenAmount.div(divisor);
      const expectedFeeMPaid = order.params.makerFee.div(divisor);
      const expectedFeeTPaid = order.params.takerFee.div(divisor);
      const tokensHashBuff = crypto.solSHA3([order.params.makerToken, order.params.takerToken]);
      const expectedTokens = ethUtil.bufferToHex(tokensHashBuff);

      assert.equal(order.params.maker, logArgs.maker);
      assert.equal(taker, logArgs.taker);
      assert.equal(order.params.feeRecipient, logArgs.feeRecipient);
      assert.equal(order.params.makerToken, logArgs.makerToken);
      assert.equal(order.params.takerToken, logArgs.takerToken);
      assert.equal(expectedFilledMakerTokenAmount.toString(), logArgs.filledMakerTokenAmount.toString());
      assert.equal(expectedFilledTakerTokenAmount.toString(), logArgs.filledTakerTokenAmount.toString());
      assert.equal(expectedFeeMPaid.toString(), logArgs.paidMakerFee.toString());
      assert.equal(expectedFeeTPaid.toString(), logArgs.paidTakerFee.toString());
      assert.equal(expectedTokens, logArgs.tokens);
      assert.equal(order.params.orderHashHex, logArgs.orderHash);
    });

    it('should log 1 event with the correct arguments when order has no feeRecipient', async () => {
      order = await orderFactory.newSignedOrderAsync({
        feeRecipient: constants.NULL_ADDRESS,
      });
      const divisor = 2;
      const res = await exWrapper.fillOrderAsync(order, taker,
                                            { fillTakerTokenAmount: order.params.takerTokenAmount.div(divisor) });
      assert.equal(res.logs.length, 1);

      const logArgs = res.logs[0].args;
      const expectedFilledMakerTokenAmount = order.params.makerTokenAmount.div(divisor);
      const expectedFilledTakerTokenAmount = order.params.takerTokenAmount.div(divisor);
      const expectedFeeMPaid = new BigNumber(0);
      const expectedFeeTPaid = new BigNumber(0);
      const tokensHashBuff = crypto.solSHA3([order.params.makerToken, order.params.takerToken]);
      const expectedTokens = ethUtil.bufferToHex(tokensHashBuff);

      assert.equal(order.params.maker, logArgs.maker);
      assert.equal(taker, logArgs.taker);
      assert.equal(order.params.feeRecipient, logArgs.feeRecipient);
      assert.equal(order.params.makerToken, logArgs.makerToken);
      assert.equal(order.params.takerToken, logArgs.takerToken);
      assert.equal(expectedFilledMakerTokenAmount.toString(), logArgs.filledMakerTokenAmount.toString());
      assert.equal(expectedFilledTakerTokenAmount.toString(), logArgs.filledTakerTokenAmount.toString());
      assert.equal(expectedFeeMPaid.toString(), logArgs.paidMakerFee.toString());
      assert.equal(expectedFeeTPaid.toString(), logArgs.paidTakerFee.toString());
      assert.equal(expectedTokens, logArgs.tokens);
      assert.equal(order.params.orderHashHex, logArgs.orderHash);
    });

    it('should throw when taker is specified and order is claimed by other', async () => {
      order = await orderFactory.newSignedOrderAsync({
        taker: feeRecipient,
        makerTokenAmount: toSmallestUnits(100),
        takerTokenAmount: toSmallestUnits(200),
      });

      try {
        await exWrapper.fillOrderAsync(order, taker);
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if signature is invalid', async () => {
      order = await orderFactory.newSignedOrderAsync({
        makerTokenAmount: toSmallestUnits(10),
      });

      order.params.r = ethUtil.bufferToHex(ethUtil.sha3('invalidR'));
      order.params.s = ethUtil.bufferToHex(ethUtil.sha3('invalidS'));
      try {
        await exWrapper.fillOrderAsync(order, taker);
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if makerTokenAmount is 0', async () => {
      order = await orderFactory.newSignedOrderAsync({
        makerTokenAmount: new BigNumber(0),
      });

      try {
        await exWrapper.fillOrderAsync(order, taker);
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if takerTokenAmount is 0', async () => {
      order = await orderFactory.newSignedOrderAsync({
        takerTokenAmount: new BigNumber(0),
      });

      try {
        await exWrapper.fillOrderAsync(order, taker);
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not change balances if maker balances are too low to fill order and shouldThrowOnInsufficientBalanceOrAllowance = false',
       async () => {
      order = await orderFactory.newSignedOrderAsync({
        makerTokenAmount: toSmallestUnits(100000),
      });

      await exWrapper.fillOrderAsync(order, taker);
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if maker balances are too low to fill order and shouldThrowOnInsufficientBalanceOrAllowance = true',
       async () => {
      order = await orderFactory.newSignedOrderAsync({
        makerTokenAmount: toSmallestUnits(100000),
      });

      try {
        await exWrapper.fillOrderAsync(order, taker, { shouldThrowOnInsufficientBalanceOrAllowance: true });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not change balances if taker balances are too low to fill order and shouldThrowOnInsufficientBalanceOrAllowance = false',
       async () => {
      order = await orderFactory.newSignedOrderAsync({
        takerTokenAmount: toSmallestUnits(100000),
      });

      await exWrapper.fillOrderAsync(order, taker);
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if taker balances are too low to fill order and shouldThrowOnInsufficientBalanceOrAllowance = true',
       async () => {
      order = await orderFactory.newSignedOrderAsync({
        takerTokenAmount: toSmallestUnits(100000),
      });

      try {
        await exWrapper.fillOrderAsync(order, taker, { shouldThrowOnInsufficientBalanceOrAllowance: true });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not change balances if maker allowances are too low to fill order and shouldThrowOnInsufficientBalanceOrAllowance = false',
       async () => {
      await rep.approve(TokenProxy.address, 0, { from: maker });
      await exWrapper.fillOrderAsync(order, taker);
      await rep.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: maker });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if maker allowances are too low to fill order and shouldThrowOnInsufficientBalanceOrAllowance = true',
       async () => {
      try {
        await rep.approve(TokenProxy.address, 0, { from: maker });
        await exWrapper.fillOrderAsync(order, taker, { shouldThrowOnInsufficientBalanceOrAllowance: true });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
        await rep.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: maker });
      }
    });

    it('should not change balances if taker allowances are too low to fill order and shouldThrowOnInsufficientBalanceOrAllowance = false',
       async () => {
      await dgd.approve(TokenProxy.address, 0, { from: taker });
      await exWrapper.fillOrderAsync(order, taker);
      await dgd.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: taker });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if taker allowances are too low to fill order and shouldThrowOnInsufficientBalanceOrAllowance = true',
       async () => {
      try {
        await dgd.approve(TokenProxy.address, 0, { from: taker });
        await exWrapper.fillOrderAsync(order, taker, { shouldThrowOnInsufficientBalanceOrAllowance: true });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
        await dgd.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: taker });
      }
    });

    it('should not change balances if makerToken is ZRX, makerTokenAmount + makerFee > maker balance, and shouldThrowOnInsufficientBalanceOrAllowance = false',
       async () => {
      const makerZRXBalance = new BigNumber(balances[maker][zrx.address]);
      order = await orderFactory.newSignedOrderAsync({
        makerToken: zrx.address,
        makerTokenAmount: makerZRXBalance,
        makerFee: new BigNumber(1),
      });
      await exWrapper.fillOrderAsync(order, taker);
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should not change balances if makerToken is ZRX, makerTokenAmount + makerFee > maker allowance, and shouldThrowOnInsufficientBalanceOrAllowance = false',
       async () => {
      const makerZRXAllowance = await zrx.allowance(maker, TokenProxy.address);
      order = await orderFactory.newSignedOrderAsync({
        makerToken: zrx.address,
        makerTokenAmount: new BigNumber(makerZRXAllowance),
        makerFee: new BigNumber(1),
      });
      await exWrapper.fillOrderAsync(order, taker);
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should not change balances if takerToken is ZRX, takerTokenAmount + takerFee > taker balance, and shouldThrowOnInsufficientBalanceOrAllowance = false',
       async () => {
      const takerZRXBalance = new BigNumber(balances[taker][zrx.address]);
      order = await orderFactory.newSignedOrderAsync({
        takerToken: zrx.address,
        takerTokenAmount: takerZRXBalance,
        takerFee: new BigNumber(1),
      });
      await exWrapper.fillOrderAsync(order, taker);
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should not change balances if takerToken is ZRX, takerTokenAmount + takerFee > taker allowance, and shouldThrowOnInsufficientBalanceOrAllowance = false',
       async () => {
      const takerZRXAllowance = await zrx.allowance(taker, TokenProxy.address);
      order = await orderFactory.newSignedOrderAsync({
        takerToken: zrx.address,
        takerTokenAmount: new BigNumber(takerZRXAllowance),
        takerFee: new BigNumber(1),
      });
      await exWrapper.fillOrderAsync(order, taker);
      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should throw if getBalance or getAllowance attempts to change state and shouldThrowOnInsufficientBalanceOrAllowance = false', async () => {
      const maliciousToken = await MaliciousToken.new();
      await maliciousToken.approve(TokenProxy.address, INITIAL_ALLOWANCE, { from: taker });

      order = await orderFactory.newSignedOrderAsync({
        takerToken: maliciousToken.address,
      });

      try {
        await exWrapper.fillOrderAsync(order, taker, { shouldThrowOnInsufficientBalanceOrAllowance: false });
        throw new Error('Fill succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not change balances if an order is expired', async () => {
      order = await orderFactory.newSignedOrderAsync({
        expirationTimestampInSec: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
      });
      await exWrapper.fillOrderAsync(order, taker);

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should log an error event if an order is expired', async () => {
      order = await orderFactory.newSignedOrderAsync({
        expirationTimestampInSec: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
      });

      const res = await exWrapper.fillOrderAsync(order, taker);
      assert.equal(res.logs.length, 1);
      const errCode = res.logs[0].args.errorId.toNumber();
      assert.equal(errCode, ExchangeContractErrs.ERROR_ORDER_EXPIRED);
    });

    it('should log an error event if no value is filled', async () => {
      await exWrapper.fillOrderAsync(order, taker);

      const res = await exWrapper.fillOrderAsync(order, taker);
      assert.equal(res.logs.length, 1);
      const errCode = res.logs[0].args.errorId.toNumber();
      assert.equal(errCode, ExchangeContractErrs.ERROR_ORDER_FULLY_FILLED_OR_CANCELLED);
    });
  });

  describe('cancelOrder', () => {
    beforeEach(async () => {
      balances = await dmyBalances.getAsync();
      order = await orderFactory.newSignedOrderAsync();
    });

    it('should throw if not sent by maker', async () => {
      try {
        await exWrapper.cancelOrderAsync(order, taker);
        throw new Error('Cancel succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if makerTokenAmount is 0', async () => {
      order = await orderFactory.newSignedOrderAsync({
        makerTokenAmount: new BigNumber(0),
      });

      try {
        await exWrapper.cancelOrderAsync(order, maker);
        throw new Error('Cancel succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if takerTokenAmount is 0', async () => {
      order = await orderFactory.newSignedOrderAsync({
        takerTokenAmount: new BigNumber(0),
      });

      try {
        await exWrapper.cancelOrderAsync(order, maker);
        throw new Error('Cancel succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should be able to cancel a full order', async () => {
      await exWrapper.cancelOrderAsync(order, maker);
      await exWrapper.fillOrderAsync(order, taker, { fillTakerTokenAmount: order.params.takerTokenAmount.div(2) });

      const newBalances = await dmyBalances.getAsync();
      assert.deepEqual(newBalances, balances);
    });

    it('should be able to cancel part of an order', async () => {
      const cancelTakerTokenAmount = order.params.takerTokenAmount.div(2);
      await exWrapper.cancelOrderAsync(order, maker, { cancelTakerTokenAmount });

      const res = await exWrapper.fillOrderAsync(order, taker, { fillTakerTokenAmount: order.params.takerTokenAmount });
      assert.equal(res.logs[0].args.filledTakerTokenAmount.toString(),
                   sub(order.params.takerTokenAmount, cancelTakerTokenAmount));

      const newBalances = await dmyBalances.getAsync();
      const cancelMakerTokenAmount = div(mul(cancelTakerTokenAmount, order.params.makerTokenAmount),
                                         order.params.takerTokenAmount);
      const paidMakerFee = div(mul(order.params.makerFee, cancelMakerTokenAmount),
                                      order.params.makerTokenAmount);
      const paidTakerFee = div(mul(order.params.takerFee, cancelMakerTokenAmount),
                                      order.params.makerTokenAmount);
      assert.equal(newBalances[maker][order.params.makerToken],
                   sub(balances[maker][order.params.makerToken], cancelMakerTokenAmount));
      assert.equal(newBalances[maker][order.params.takerToken],
                   add(balances[maker][order.params.takerToken], cancelTakerTokenAmount));
      assert.equal(newBalances[maker][zrx.address],
                   sub(balances[maker][zrx.address], paidMakerFee));
      assert.equal(newBalances[taker][order.params.takerToken],
                   sub(balances[taker][order.params.takerToken], cancelTakerTokenAmount));
      assert.equal(newBalances[taker][order.params.makerToken],
                   add(balances[taker][order.params.makerToken], cancelMakerTokenAmount));
      assert.equal(newBalances[taker][zrx.address], sub(balances[taker][zrx.address], paidTakerFee));
      assert.equal(newBalances[feeRecipient][zrx.address],
                   add(balances[feeRecipient][zrx.address], add(paidMakerFee, paidTakerFee)));
    });

    it('should log 1 event with correct arguments', async () => {
      const divisor = 2;
      const res = await exWrapper.cancelOrderAsync(order, maker,
                                              { cancelTakerTokenAmount: order.params.takerTokenAmount.div(divisor) });
      assert.equal(res.logs.length, 1);

      const logArgs = res.logs[0].args;
      const expectedCancelledMakerTokenAmount = order.params.makerTokenAmount.div(divisor);
      const expectedCancelledTakerTokenAmount = order.params.takerTokenAmount.div(divisor);
      const tokensHashBuff = crypto.solSHA3([order.params.makerToken, order.params.takerToken]);
      const expectedTokens = ethUtil.bufferToHex(tokensHashBuff);

      assert.equal(order.params.maker, logArgs.maker);
      assert.equal(order.params.feeRecipient, logArgs.feeRecipient);
      assert.equal(order.params.makerToken, logArgs.makerToken);
      assert.equal(order.params.takerToken, logArgs.takerToken);
      assert.equal(expectedCancelledMakerTokenAmount.toString(), logArgs.cancelledMakerTokenAmount.toString());
      assert.equal(expectedCancelledTakerTokenAmount.toString(), logArgs.cancelledTakerTokenAmount.toString());
      assert.equal(expectedTokens, logArgs.tokens);
      assert.equal(order.params.orderHashHex, logArgs.orderHash);
    });

    it('should not log events if no value is cancelled', async () => {
      await exWrapper.cancelOrderAsync(order, maker);

      const res = await exWrapper.cancelOrderAsync(order, maker);
      assert.equal(res.logs.length, 1);
      const errId = res.logs[0].args.errorId.toNumber();
      const errCode = res.logs[0].args.errorId.toNumber();
      assert.equal(errCode, ExchangeContractErrs.ERROR_ORDER_FULLY_FILLED_OR_CANCELLED);
    });

    it('should not log events if order is expired', async () => {
      order = await orderFactory.newSignedOrderAsync({
        expirationTimestampInSec: new BigNumber(Math.floor((Date.now() - 10000) / 1000)),
      });

      const res = await exWrapper.cancelOrderAsync(order, maker);
      assert.equal(res.logs.length, 1);
      const errCode = res.logs[0].args.errorId.toNumber();
      assert.equal(errCode, ExchangeContractErrs.ERROR_ORDER_EXPIRED);
    });
  });
});
