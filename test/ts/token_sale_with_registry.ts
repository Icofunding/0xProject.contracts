import * as assert from 'assert';
import Web3 = require('web3');
import * as BigNumber from 'bignumber.js';
import * as _ from 'lodash';
import promisify = require('es6-promisify');
import ethUtil = require('ethereumjs-util');
import { Balances } from '../../util/balances';
import { crypto } from '../../util/crypto';
import { BNUtil } from '../../util/bn_util';
import { testUtil } from '../../util/test_util';
import { Order } from '../../util/order';
import { BalancesByOwner, ContractInstance, OrderParams } from '../../util/types';
import { Artifacts } from '../../util/artifacts';
import { constants } from '../../util/constants';
import { RPC } from '../../util/rpc';

const {
  TokenSaleWithRegistry,
  TokenRegistry,
  Exchange,
  DummyToken,
  TokenProxy,
} = new Artifacts(artifacts);

const { add, sub, mul, div, cmp, toSmallestUnits } = BNUtil;

// In order to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
// with type `any` to a variable of type `Web3`.
const web3Instance: Web3 = web3;
const rpc = new RPC();

contract('TokenSaleWithRegistry', (accounts: string[]) => {
  const maker = accounts[0];
  const taker = accounts[1];
  const owner = accounts[0];
  const notOwner = accounts[1];

  const baseEthCapPerAddress = new BigNumber(web3Instance.toWei(0.1, 'ether'));
  const gasPrice = new BigNumber(web3Instance.toWei(20, 'gwei'));
  const timePeriodInSec = 86400; // seconds in 1 day
  const secondsToAdd = 100; // seconds until start time from current timestamp

  let currentBlockTimestamp: BigNumber.BigNumber;
  let startTimeInSec: BigNumber.BigNumber;

  let tokenRegistry: ContractInstance;
  let tokenSaleWithRegistry: ContractInstance;
  let exchange: ContractInstance;
  let zrx: ContractInstance;
  let wEth: ContractInstance;

  let invalidTokenAddress: string;
  let zrxAddress: string;
  let wEthAddress: string;

  let validOrder: Order;
  let validOrderParams: OrderParams;
  let dmyBalances: Balances;

  const sendTransactionAsync = promisify(web3Instance.eth.sendTransaction);
  const getEthBalanceAsync = promisify(web3Instance.eth.getBalance);
  const getTransactionReceiptAsync = promisify(web3Instance.eth.getTransactionReceipt);

  const getBlockTimestampAsync = async (): Promise<BigNumber.BigNumber> => {
    const blockNum = await promisify(web3Instance.eth.getBlockNumber)();
    const blockData = await promisify(web3Instance.eth.getBlock)(blockNum);
    const blockTimestamp: number = blockData.timestamp;

    return new BigNumber(blockTimestamp);
  };

  const getHardCodedEthCapPerAddress = (baseEthCapPerAddress: BigNumber.BigNumber, periodNumber: number): BigNumber.BigNumber => {
    let multiplier: number;
    if (periodNumber > 4) {
      throw new Error('Only period numbers up to 4 are hard coded into getHardCodedEthCapPerAddress');
    } else if (periodNumber === 4) {
      multiplier = 15;
    } else if (periodNumber === 3) {
      multiplier = 7;
    } else if (periodNumber === 2) {
      multiplier = 3;
    } else if (periodNumber === 1) {
      multiplier = 1;
    }
    const ethCapPerAddress = baseEthCapPerAddress.mul(multiplier);
    return ethCapPerAddress;
  };

  before(async () => {
    [exchange, tokenRegistry] = await Promise.all([
      Exchange.deployed(),
      TokenRegistry.deployed(),
    ]);
    [zrxAddress, wEthAddress, invalidTokenAddress] = await Promise.all([
      tokenRegistry.getTokenAddressBySymbol('ZRX'),
      tokenRegistry.getTokenAddressBySymbol('WETH'),
      tokenRegistry.getTokenAddressBySymbol('REP'),
    ]);

    [zrx, wEth] = await Promise.all([
      DummyToken.at(zrxAddress),
      DummyToken.at(wEthAddress),
    ]);
    dmyBalances = new Balances([zrx, wEth], [maker, taker]);
  });

  beforeEach(async () => {
    tokenSaleWithRegistry = await TokenSaleWithRegistry.new(
      Exchange.address,
      zrxAddress,
      wEthAddress,
    );

    const expirationInFuture = new BigNumber(Math.floor(Date.now() / 1000) + 1000000000);

    validOrderParams = {
      exchangeContractAddress: Exchange.address,
      maker,
      taker: tokenSaleWithRegistry.address,
      feeRecipient: constants.NULL_ADDRESS,
      makerToken: zrxAddress,
      takerToken: wEthAddress,
      makerTokenAmount: toSmallestUnits(2),
      takerTokenAmount: toSmallestUnits(2),
      makerFee: new BigNumber(0),
      takerFee: new BigNumber(0),
      expirationTimestampInSec: expirationInFuture,
      salt: new BigNumber(0),
    };
    validOrder = new Order(validOrderParams);
    await validOrder.signAsync();

    await Promise.all([
      zrx.approve(TokenProxy.address, mul(validOrder.params.makerTokenAmount, 100), { from: maker }),
      zrx.setBalance(maker, mul(validOrder.params.makerTokenAmount, 100), { from: owner }),
    ]);

    currentBlockTimestamp = new BigNumber(await getBlockTimestampAsync());
    startTimeInSec = currentBlockTimestamp.plus(secondsToAdd);
  });

  describe('initializeSale', () => {
    it('should throw when not called by owner', async () => {
      const params = validOrder.createFill();
      try {
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: notOwner },
        );
        throw new Error('initializeSale succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if called with an invalid order signature', async () => {
      try {
        const params = validOrder.createFill();
        const invalidR = ethUtil.bufferToHex(ethUtil.sha3('invalidR'));
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          invalidR,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
        );
        throw new Error('initializeSale succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw without the makerToken set to the protocol token', async () => {
      const invalidOrderParams: OrderParams = _.assign({}, validOrderParams, { makerToken: invalidTokenAddress });
      const newOrder = new Order(invalidOrderParams);
      await newOrder.signAsync();
      const params = newOrder.createFill();

      try {
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
        );
        throw new Error('initializeSale succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if called without the takerToken set to the wrapped ETH token', async () => {
      const invalidOrderParams: OrderParams = _.assign({}, validOrderParams, { takerToken: invalidTokenAddress });
      const newOrder = new Order(invalidOrderParams);
      await newOrder.signAsync();
      const params = newOrder.createFill();

      try {
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
        );
        throw new Error('initializeSale succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if the order taker is not the crowdsale contract address', async () => {
      const invalidOrderParams: OrderParams = _.assign({}, validOrderParams, { taker: constants.NULL_ADDRESS });
      const invalidOrder = new Order(invalidOrderParams);
      await invalidOrder.signAsync();
      const params = invalidOrder.createFill();
      try {
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );
        throw new Error('initializeSale succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if order feeRecipient is not null', async () => {
      const invalidFeeRecipient = accounts[0];
      const invalidOrderParams: OrderParams = _.assign({}, validOrderParams, { feeRecipient: invalidFeeRecipient });
      const invalidOrder = new Order(invalidOrderParams);
      await invalidOrder.signAsync();
      const params = invalidOrder.createFill();
      try {
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );
        throw new Error('initializeSale succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw with an invalid start time', async () => {
      const params = validOrder.createFill();
      startTimeInSec = currentBlockTimestamp.minus(1);
      try {
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );
        throw new Error('initializeSale succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if baseEthCapPerAddress is 0', async () => {
      const params = validOrder.createFill();
      const invalidBaseEthCapPerAddress = new BigNumber(0);
      try {
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          invalidBaseEthCapPerAddress,
          { from: owner },
        );
        throw new Error('initializeSale succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should initialize the sale with valid order params and log correct args', async () => {
      const params = validOrder.createFill();
      const res = await tokenSaleWithRegistry.initializeSale(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        startTimeInSec,
        baseEthCapPerAddress,
        { from: owner },
      );

      assert.equal(res.logs.length, 1, 'Expected a single event to fire when the sale is successfully initialized');
      const logArgs = res.logs[0].args;
      assert.equal(logArgs.startTimeInSec.toString(), startTimeInSec.toString());

      const isSaleInitialized = await tokenSaleWithRegistry.isSaleInitialized.call();
      assert.equal(isSaleInitialized, true);
    });

    it('should throw if the sale has already been initialized', async () => {
      const params = validOrder.createFill();
      await tokenSaleWithRegistry.initializeSale(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        startTimeInSec,
        baseEthCapPerAddress,
        { from: owner },
      );
      try {
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );
        throw new Error('initializeSale succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('changeRegistrationStatus', () => {
    it('should throw if not called by owner', async () => {
      try {
        const isRegistered = true;
        await tokenSaleWithRegistry.changeRegistrationStatus(taker, isRegistered, { from: notOwner });
        throw new Error('changeRegistrationStatus succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should change registration status of an address if called by owner before sale has been initialized', async () => {
      let isRegistered = true;
      await tokenSaleWithRegistry.changeRegistrationStatus(taker, isRegistered, { from: owner });
      let isTakerRegistered = await tokenSaleWithRegistry.registered.call(taker);
      assert.equal(isTakerRegistered, true);

      isRegistered = false;
      await tokenSaleWithRegistry.changeRegistrationStatus(taker, isRegistered, { from: owner });
      isTakerRegistered = await tokenSaleWithRegistry.registered.call(taker);
      assert.equal(isTakerRegistered, false);
    });

    it('should throw if called after distrubution has been initialized', async () => {
      const params = validOrder.createFill();

      currentBlockTimestamp = new BigNumber(await getBlockTimestampAsync());
      const secondsToAdd = 100;
      startTimeInSec = currentBlockTimestamp.plus(secondsToAdd);

      await tokenSaleWithRegistry.initializeSale(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        startTimeInSec,
        baseEthCapPerAddress,
        { from: owner },
      );
      try {
        const isRegistered = true;
        await tokenSaleWithRegistry.changeRegistrationStatus(taker, isRegistered, { from: owner });
        throw new Error('changeRegistrationStatus succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('changeRegistrationStatuses', () => {
    it('should throw if not called by owner', async () => {
      const isRegistered = true;
      try {
        await tokenSaleWithRegistry.changeRegistrationStatuses([taker], isRegistered, { from: notOwner });
        throw new Error('changeRegistrationStatuses succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should change registration statuses of addresses if called by owner before sale has been initialized', async () => {
      let isRegistered = true;
      await tokenSaleWithRegistry.changeRegistrationStatuses([maker, taker], isRegistered, { from: owner });
      let isMakerRegistered = await tokenSaleWithRegistry.registered.call(maker);
      let isTakerRegistered = await tokenSaleWithRegistry.registered.call(taker);
      assert.equal(isMakerRegistered, true);
      assert.equal(isTakerRegistered, true);

      isRegistered = false;
      await tokenSaleWithRegistry.changeRegistrationStatuses([maker, taker], isRegistered, { from: owner });
      isMakerRegistered = await tokenSaleWithRegistry.registered.call(maker);
      isTakerRegistered = await tokenSaleWithRegistry.registered.call(taker);
      assert.equal(isMakerRegistered, false);
      assert.equal(isTakerRegistered, false);
    });

    it('should throw if called after distrubution has been initialized', async () => {
      const params = validOrder.createFill();

      currentBlockTimestamp = new BigNumber(await getBlockTimestampAsync());
      const secondsToAdd = 100;
      startTimeInSec = currentBlockTimestamp.plus(secondsToAdd);

      await tokenSaleWithRegistry.initializeSale(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        startTimeInSec,
        baseEthCapPerAddress,
        { from: owner },
      );
      try {
        const isRegistered = true;
        await tokenSaleWithRegistry.changeRegistrationStatuses([maker, taker], isRegistered, { from: owner });
        throw new Error('changeRegistrationStatuses succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('getEthCapPerAddress', () => {
    it('should return 0 before the sale has been initialized', async () => {
      const ethCapPerAddress = await tokenSaleWithRegistry.getEthCapPerAddress.call();
      const expectedEthCapPerAddress = '0';
      assert.equal(ethCapPerAddress.toString(), expectedEthCapPerAddress);
    });

    it('should return 0 after the sale has been initialized but not yet started', async () => {
      const params = validOrder.createFill();
      await tokenSaleWithRegistry.initializeSale(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        startTimeInSec,
        baseEthCapPerAddress,
        { from: owner },
      );

      const ethCapPerAddress = await tokenSaleWithRegistry.getEthCapPerAddress.call();
      const expectedEthCapPerAddress = '0';
      assert.equal(ethCapPerAddress.toString(), expectedEthCapPerAddress);
    });

    it('should return the baseEthCapPerAddress during the first period', async () => {
      const params = validOrder.createFill();
      await tokenSaleWithRegistry.initializeSale(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        startTimeInSec,
        baseEthCapPerAddress,
        { from: owner },
      );

      await rpc.increaseTimeAsync(secondsToAdd);
      await rpc.mineBlockAsync();

      const ethCapPerAddress = await tokenSaleWithRegistry.getEthCapPerAddress.call();
      const expectedEthCapPerAddress = baseEthCapPerAddress;
      assert.equal(ethCapPerAddress.toString(), expectedEthCapPerAddress.toString());
    });

    it('the ethCapPerAddress should increase by double the previous increase at each next period', async () => {
      let period = 1;
      const params = validOrder.createFill();
      await tokenSaleWithRegistry.initializeSale(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        startTimeInSec,
        baseEthCapPerAddress,
        { from: owner },
      );

      await rpc.increaseTimeAsync(timePeriodInSec + secondsToAdd);
      await rpc.mineBlockAsync();
      period += 1;

      const ethCapPerAddress2 = await tokenSaleWithRegistry.getEthCapPerAddress.call();
      const expectedEthCapPerAddress2 = getHardCodedEthCapPerAddress(baseEthCapPerAddress, period);
      assert.equal(ethCapPerAddress2.toString(), expectedEthCapPerAddress2.toString());

      await rpc.increaseTimeAsync(timePeriodInSec);
      await rpc.mineBlockAsync();
      period += 1;

      const ethCapPerAddress3 = await tokenSaleWithRegistry.getEthCapPerAddress.call();
      const expectedEthCapPerAddress3 = getHardCodedEthCapPerAddress(baseEthCapPerAddress, period);
      assert.equal(ethCapPerAddress3.toString(), expectedEthCapPerAddress3.toString());
    });
  });

  describe('contributing', () => {
    beforeEach(async () => {
      const isRegistered = true;
      await tokenSaleWithRegistry.changeRegistrationStatus(taker, isRegistered, { from: owner });
    });

    describe('fillOrderWithEth', () => {
      it('should throw if sale not initialized', async () => {
        try {
          const ethValue = new BigNumber(1);
          await tokenSaleWithRegistry.fillOrderWithEth({
            from: taker,
            value: ethValue,
          });
          throw new Error('Fallback succeeded when it should have thrown');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

      it('should throw if the caller is not registered', async () => {
        const isRegistered = false;
        await tokenSaleWithRegistry.changeRegistrationStatus(taker, isRegistered, { from: owner });

        validOrderParams = _.assign({}, validOrderParams, { taker: tokenSaleWithRegistry.address });
        validOrder = new Order(validOrderParams);
        await validOrder.signAsync();
        const params = validOrder.createFill();
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );

        try {
          const ethValue = new BigNumber(1);
          await tokenSaleWithRegistry.fillOrderWithEth({
            from: taker,
            value: ethValue,
          });
          throw new Error('Fallback succeeded when it should have thrown');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

      it('should throw if the sale has not started', async () => {
        const params = validOrder.createFill();
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );

        try {
          const ethValue = new BigNumber(1);
          await tokenSaleWithRegistry.fillOrderWithEth({
            from: taker,
            value: ethValue,
          });
          throw new Error('Fallback succeeded when it should have thrown');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

      it('should trade sent ETH for protocol tokens if ETH <= remaining order ETH and ethCapPerAddress',
         async () => {
        const initBalances: BalancesByOwner = await dmyBalances.getAsync();
        const initTakerEthBalance = await getEthBalanceAsync(taker);

        const ethValue = baseEthCapPerAddress;
        const zrxValue = div(mul(ethValue, validOrder.params.makerTokenAmount), validOrder.params.takerTokenAmount);

        const params = validOrder.createFill();
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );

        await rpc.increaseTimeAsync(secondsToAdd);
        const res = await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });

        const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
        const finalTakerEthBalance = await getEthBalanceAsync(taker);
        const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);
        const remainingTakerBalanceAfterFillAndGas = sub(sub(initTakerEthBalance, ethValue), ethSpentOnGas);

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], zrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], ethValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], zrxValue));
        assert.equal(finalTakerEthBalance, remainingTakerBalanceAfterFillAndGas);
      });

      it('should fill the remaining ethCapPerAddress and refund difference if sent > than the remaining ethCapPerAddress',
         async () => {
        const initBalances: BalancesByOwner = await dmyBalances.getAsync();
        const initTakerEthBalance = await getEthBalanceAsync(taker);
        const ethValue = add(baseEthCapPerAddress, 1);

        const params = validOrder.createFill();
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );

        await rpc.increaseTimeAsync(secondsToAdd);
        const res = await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });

        const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
        const finalTakerEthBalance = await getEthBalanceAsync(taker);
        const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);
        const filledZrxValue = baseEthCapPerAddress;
        const filledEthValue = baseEthCapPerAddress;
        const remainingTakerBalanceAfterFillAndGas = sub(sub(initTakerEthBalance, filledEthValue), ethSpentOnGas);

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], filledZrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], filledEthValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], filledZrxValue));
        assert.equal(finalTakerEthBalance, remainingTakerBalanceAfterFillAndGas);
      });

      it('should partial fill, end sale, and refund difference if sender is registered and sent ETH > remaining order ETH', async () => {
        const initBalances: BalancesByOwner = await dmyBalances.getAsync();
        const initTakerEthBalance = await getEthBalanceAsync(taker);

        const newBaseEthCapPerAddress = validOrder.params.takerTokenAmount;
        const params = validOrder.createFill();
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          newBaseEthCapPerAddress,
          { from: owner },
        );

        const ethValue = add(validOrder.params.takerTokenAmount, 1);

        await rpc.increaseTimeAsync(secondsToAdd);
        const res = await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });
        const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
        const finalTakerEthBalance = await getEthBalanceAsync(taker);
        const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);
        const filledZrxValue = validOrder.params.makerTokenAmount;
        const filledEthValue = validOrder.params.takerTokenAmount;
        const remainingTakerBalanceAfterFillAndGas = sub(sub(initTakerEthBalance, filledEthValue), ethSpentOnGas);

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], filledZrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], filledEthValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], filledZrxValue));
        assert.equal(finalTakerEthBalance, remainingTakerBalanceAfterFillAndGas);

        assert.equal(res.receipt.logs.length, 5, 'Expected 5 events to fire when the sale is successfully initialized');
        const finishedLog = res.receipt.logs[4];
        const logData = finishedLog.data;
        const endTimeInSec = parseInt(logData, 16);
        assert.equal(endTimeInSec.toString(), startTimeInSec.toString());

        const isSaleFinished = await tokenSaleWithRegistry.isSaleFinished.call();
        assert.equal(isSaleFinished, true);
      });

      it('should allow an address to buy up to the new cap in each period', async () => {
        const initBalances: BalancesByOwner = await dmyBalances.getAsync();
        const initTakerEthBalance = await getEthBalanceAsync(taker);

        const params = validOrder.createFill();
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );

        await rpc.increaseTimeAsync(secondsToAdd);
        let period = 1;
        let ethValue = getHardCodedEthCapPerAddress(baseEthCapPerAddress, period);
        let res = await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });

        let finalBalances: BalancesByOwner = await dmyBalances.getAsync();
        let finalTakerEthBalance = await getEthBalanceAsync(taker);
        let totalEthSpentOnGas = mul(res.receipt.gasUsed, gasPrice);
        let totalFilledZrxValue = ethValue;
        let totalFilledEthValue = ethValue;
        let remainingTakerBalanceAfterFillAndGas = sub(sub(initTakerEthBalance, totalFilledEthValue), totalEthSpentOnGas);

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], totalFilledZrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], totalFilledEthValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], totalFilledZrxValue));
        assert.equal(finalTakerEthBalance, remainingTakerBalanceAfterFillAndGas);

        await rpc.increaseTimeAsync(timePeriodInSec);
        period += 1;
        let totalEthValue = getHardCodedEthCapPerAddress(baseEthCapPerAddress, period);
        ethValue = totalEthValue.minus(ethValue);
        res = await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });

        finalBalances = await dmyBalances.getAsync();
        finalTakerEthBalance = await getEthBalanceAsync(taker);
        totalEthSpentOnGas = add(totalEthSpentOnGas, mul(res.receipt.gasUsed, gasPrice));
        totalFilledZrxValue = totalEthValue;
        totalFilledEthValue = totalEthValue;
        remainingTakerBalanceAfterFillAndGas = sub(sub(initTakerEthBalance, totalFilledEthValue), totalEthSpentOnGas);

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], totalFilledZrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], totalFilledEthValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], totalFilledZrxValue));
        assert.equal(finalTakerEthBalance, remainingTakerBalanceAfterFillAndGas);

        await rpc.increaseTimeAsync(timePeriodInSec);
        period += 1;
        totalEthValue = getHardCodedEthCapPerAddress(baseEthCapPerAddress, period);
        ethValue = totalEthValue.minus(ethValue);
        res = await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });

        finalBalances = await dmyBalances.getAsync();
        finalTakerEthBalance = await getEthBalanceAsync(taker);
        totalEthSpentOnGas = add(totalEthSpentOnGas, mul(res.receipt.gasUsed, gasPrice));
        totalFilledZrxValue = totalEthValue;
        totalFilledEthValue = totalEthValue;
        remainingTakerBalanceAfterFillAndGas = sub(sub(initTakerEthBalance, totalFilledEthValue), totalEthSpentOnGas);

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], totalFilledZrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], totalFilledEthValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], totalFilledZrxValue));
        assert.equal(finalTakerEthBalance, remainingTakerBalanceAfterFillAndGas);
      });

      it('should throw if sale has ended', async () => {
        const newBaseEthCapPerAddress = validOrder.params.takerTokenAmount;
        const params = validOrder.createFill();
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          newBaseEthCapPerAddress,
          { from: owner },
        );

        const ethValue = add(validOrder.params.takerTokenAmount, 1);

        await rpc.increaseTimeAsync(secondsToAdd);
        await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });

        const isSaleFinished = await tokenSaleWithRegistry.isSaleFinished.call();
        assert.equal(isSaleFinished, true);

        try {
          const newEthValue = new BigNumber(1);
          await tokenSaleWithRegistry.fillOrderWithEth({
            from: taker,
            value: newEthValue,
          });
          throw new Error('Fallback succeeded when it should have thrown');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });
    });

    describe('fallback', () => {
      it('should trade sent ETH for protocol tokens if ETH <= remaining order ETH and ethCapPerAddress',
         async () => {
        const initBalances: BalancesByOwner = await dmyBalances.getAsync();
        const initTakerEthBalance = await getEthBalanceAsync(taker);

        const params = validOrder.createFill();
        await tokenSaleWithRegistry.initializeSale(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          startTimeInSec,
          baseEthCapPerAddress,
          { from: owner },
        );

        const ethValue = baseEthCapPerAddress;
        const zrxValue = div(mul(ethValue, validOrder.params.makerTokenAmount), validOrder.params.takerTokenAmount);

        const gas = 300000;

        await rpc.increaseTimeAsync(secondsToAdd);
        const txHash = await sendTransactionAsync({
          from: taker,
          to: tokenSaleWithRegistry.address,
          value: ethValue,
          gas,
          gasPrice,
        });
        const receipt = await getTransactionReceiptAsync(txHash);

        const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
        const finalTakerEthBalance = await getEthBalanceAsync(taker);
        const ethSpentOnGas = mul(receipt.gasUsed, gasPrice);

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], zrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], ethValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], zrxValue));
        assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, ethValue), ethSpentOnGas));
      });
    });
  });
});
