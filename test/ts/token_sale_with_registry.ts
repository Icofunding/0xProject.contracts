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

const {
  TokenSaleWithRegistry,
  TokenRegistry,
  Exchange,
  DummyToken,
  Proxy,
} = new Artifacts(artifacts);

const { add, sub, mul, div, cmp, toSmallestUnits } = BNUtil;

// In order to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
// with type `any` to a variable of type `Web3`.
const web3Instance: Web3 = web3;

contract('TokenSaleWithRegistry', (accounts: string[]) => {
  const maker = accounts[0];
  const taker = accounts[1];
  const owner = accounts[0];
  const notOwner = accounts[1];

  let ethCapPerAddress = new BigNumber(web3Instance.toWei(1, 'ether'));
  const gasPrice = new BigNumber(web3Instance.toWei(20, 'gwei'));

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
      Proxy.address,
      zrxAddress,
      wEthAddress,
      ethCapPerAddress,
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
      zrx.approve(Proxy.address, mul(validOrder.params.makerTokenAmount, 100), { from: maker }),
      zrx.setBalance(maker, mul(validOrder.params.makerTokenAmount, 100), { from: owner }),
    ]);
  });

  describe('init', () => {
    it('should throw when not called by owner', async () => {
      const params = validOrder.createFill();
      try {
        await tokenSaleWithRegistry.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          { from: notOwner },
        );
        throw new Error('init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if called with an invalid order signature', async () => {
      try {
        const params = validOrder.createFill();
        const invalidR = ethUtil.bufferToHex(ethUtil.sha3('invalidR'));
        await tokenSaleWithRegistry.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          invalidR,
          params.s,
        );
        throw new Error('init succeeded when it should have thrown');
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
        await tokenSaleWithRegistry.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
        );
        throw new Error('init succeeded when it should have thrown');
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
        await tokenSaleWithRegistry.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
        );
        throw new Error('init succeeded when it should have thrown');
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
        await tokenSaleWithRegistry.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          { from: owner },
        );
        throw new Error('init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should initialize the sale with valid order params and log correct args', async () => {
      const params = validOrder.createFill();
      const res = await tokenSaleWithRegistry.init(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        { from: owner },
      );

      assert.equal(res.logs.length, 1, 'Expected a single event to fire when the sale is successfully initialized');
      const logArgs = res.logs[0].args;
      assert.equal(logArgs.maker, validOrder.params.maker);
      assert.equal(logArgs.taker, validOrder.params.taker);
      assert.equal(logArgs.makerToken, validOrder.params.makerToken);
      assert.equal(logArgs.takerToken, validOrder.params.takerToken);
      assert.equal(logArgs.feeRecipient, validOrder.params.feeRecipient);
      assert.equal(cmp(logArgs.makerTokenAmount, validOrder.params.makerTokenAmount), 0);
      assert.equal(cmp(logArgs.takerTokenAmount, validOrder.params.takerTokenAmount), 0);
      assert.equal(cmp(logArgs.makerFee, validOrder.params.makerFee), 0);
      assert.equal(cmp(logArgs.takerFee, validOrder.params.takerFee), 0);
      assert.equal(cmp(logArgs.expirationTimestampInSec, validOrder.params.expirationTimestampInSec), 0);
      assert.equal(cmp(logArgs.salt, validOrder.params.salt), 0);
      assert.equal(logArgs.v, validOrder.params.v);
      assert.equal(logArgs.r, validOrder.params.r);
      assert.equal(logArgs.s, validOrder.params.s);

      const isInitialized = await tokenSaleWithRegistry.isInitialized.call();
      assert.equal(isInitialized, true);
    });

    it('should throw if the sale has already been initialized', async () => {
      const params = validOrder.createFill();
      await tokenSaleWithRegistry.init(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        { from: owner },
      );
      try {
        await tokenSaleWithRegistry.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          { from: owner },
        );
        throw new Error('init succeeded when it should have thrown');
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
      await tokenSaleWithRegistry.init(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
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
      await tokenSaleWithRegistry.init(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
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

  describe('setCapPerAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        const newCapPerAddress = web3Instance.toWei(1.1, 'ether');
        await tokenSaleWithRegistry.setCapPerAddress(newCapPerAddress, { from: notOwner });
        throw new Error('setCapPerAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should set a new ethCapPerAddress if called by owner', async () => {
      const newCapPerAddress = new BigNumber(web3Instance.toWei(1.1, 'ether'));
      await tokenSaleWithRegistry.setCapPerAddress(newCapPerAddress, { from: owner });
      ethCapPerAddress = await tokenSaleWithRegistry.ethCapPerAddress.call();
      assert.equal(cmp(newCapPerAddress, ethCapPerAddress), 0);
    });
  });

  describe('contributing', () => {
    beforeEach(async () => {
      const isRegistered = true;
      await tokenSaleWithRegistry.changeRegistrationStatus(taker, isRegistered, { from: owner });

      const params = validOrder.createFill();
      await tokenSaleWithRegistry.init(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        { from: owner },
      );
    });

    describe('fillOrderWithEth', () => {
      it('should throw if sale not initialized', async () => {
        tokenSaleWithRegistry = await TokenSaleWithRegistry.new(
          Exchange.address,
          Proxy.address,
          zrxAddress,
          wEthAddress,
          ethCapPerAddress,
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

      it('should throw if the caller is not registered', async () => {
        tokenSaleWithRegistry = await TokenSaleWithRegistry.new(
          Exchange.address,
          Proxy.address,
          zrxAddress,
          wEthAddress,
          ethCapPerAddress,
          { from: owner },
        );

        const isRegistered = false;
        await tokenSaleWithRegistry.changeRegistrationStatus(taker, isRegistered, { from: owner });

        validOrderParams = _.assign({}, validOrderParams, { taker: tokenSaleWithRegistry.address });
        validOrder = new Order(validOrderParams);
        await validOrder.signAsync();
        const params = validOrder.createFill();
        await tokenSaleWithRegistry.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
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

        const ethValue = web3Instance.toWei(1, 'ether');
        const zrxValue = div(mul(ethValue, validOrder.params.makerTokenAmount), validOrder.params.takerTokenAmount);

        const res = await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });

        const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
        const finalTakerEthBalance = await getEthBalanceAsync(taker);
        const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], zrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], ethValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], zrxValue));
        assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, ethValue), ethSpentOnGas));
      });

      it('should fill the remaining ethCapPerAddress if sent > than the remaining ethCapPerAddress',
         async () => {
        const initBalances: BalancesByOwner = await dmyBalances.getAsync();
        const initTakerEthBalance = await getEthBalanceAsync(taker);
        const ethValue = add(ethCapPerAddress, 1);

        const res = await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });

        const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
        const finalTakerEthBalance = await getEthBalanceAsync(taker);
        const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);
        const filledZrxValue = ethCapPerAddress;
        const filledEthValue = ethCapPerAddress;

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], filledZrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], filledEthValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], filledZrxValue));
        assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, filledEthValue), ethSpentOnGas));
      });

      it('should partial fill and end sale if sender is registered and sent ETH > remaining order ETH', async () => {
        const newCapPerAddress = mul(validOrder.params.makerTokenAmount, 2);
        await tokenSaleWithRegistry.setCapPerAddress(newCapPerAddress, { from: owner });
        const initBalances: BalancesByOwner = await dmyBalances.getAsync();
        const initTakerEthBalance = await getEthBalanceAsync(taker);

        const ethValue = add(validOrder.params.takerTokenAmount, 1);

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

        assert.equal(finalBalances[maker][validOrder.params.makerToken],
                     sub(initBalances[maker][validOrder.params.makerToken], filledZrxValue));
        assert.equal(finalBalances[maker][validOrder.params.takerToken],
                     add(initBalances[maker][validOrder.params.takerToken], filledEthValue));
        assert.equal(finalBalances[taker][validOrder.params.makerToken],
                     add(initBalances[taker][validOrder.params.makerToken], filledZrxValue));
        assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, filledEthValue), ethSpentOnGas));

        assert.equal(res.receipt.logs.length, 5, 'Expected 5 events to fire when the sale is successfully initialized');
        const finishedLog = res.receipt.logs[4];
        const funcSig = finishedLog.topics[0].slice(2, 10);
        const expectedFuncSig = crypto.solSHA3(['Finished()']).slice(0, 4).toString('hex');
        assert.equal(funcSig, expectedFuncSig);

        const isFinished = await tokenSaleWithRegistry.isFinished.call();
        assert.equal(isFinished, true);
      });

      it('should throw if sale has ended', async () => {
        const newCapPerAddress = mul(validOrder.params.makerTokenAmount, 2);
        await tokenSaleWithRegistry.setCapPerAddress(newCapPerAddress, { from: owner });

        const ethValue = add(validOrder.params.takerTokenAmount, 1);

        await tokenSaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gasPrice,
        });

        const isFinished = await tokenSaleWithRegistry.isFinished.call();
        assert.equal(isFinished, true);

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

        const ethValue = web3Instance.toWei(1, 'ether');
        const zrxValue = div(mul(ethValue, validOrder.params.makerTokenAmount), validOrder.params.takerTokenAmount);

        const gas = 300000;

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
