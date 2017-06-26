import * as assert from 'assert';
import Web3 = require('web3');
import * as BigNumber from 'bignumber.js';
import promisify = require('es6-promisify');
import ethUtil = require('ethereumjs-util');
import { Balances } from '../../util/balances';
import { BNUtil } from '../../util/bn_util';
import { testUtil } from '../../util/test_util';
import { Order } from '../../util/order';
import { BalancesByOwner, ContractInstance } from '../../util/types';
import { Artifacts } from '../../util/artifacts';
import { constants } from '../../util/constants';

const {
  CrowdsaleWithRegistry,
  TokenRegistry,
  Exchange,
  DummyToken,
  Proxy,
} = new Artifacts(artifacts);

const { add, sub, mul, div, cmp, toSmallestUnits } = BNUtil;

// In validOrder to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
// with type `any` to a variable of type `Web3`.
const web3Instance: Web3 = web3;

contract('CrowdsaleWithRegistry', (accounts: string[]) => {
  const maker = accounts[0];
  const taker = accounts[1];
  const owner = accounts[0];
  const notOwner = accounts[1];

  let capPerAddress = new BigNumber(web3Instance.toWei(1, 'ether'));

  let tokenRegistry: ContractInstance;
  let crowdsaleWithRegistry: ContractInstance;
  let exchange: ContractInstance;
  let zrx: ContractInstance;
  let wEth: ContractInstance;

  let invalidTokenAddress: string;
  let zrxAddress: string;
  let wEthAddress: string;


  let validOrder: Order;
  let validOrderParams: any;
  let dmyBalances: Balances;

  const sendTransaction = promisify(web3Instance.eth.sendTransaction);
  const getEthBalance = promisify(web3Instance.eth.getBalance);
  const getTransactionReceipt = promisify(web3Instance.eth.getTransactionReceipt);

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
    crowdsaleWithRegistry = await CrowdsaleWithRegistry.new(
      Exchange.address,
      Proxy.address,
      zrxAddress,
      wEthAddress,
      capPerAddress,
    );

    validOrderParams = {
      exchangeContractAddress: Exchange.address,
      maker,
      taker: crowdsaleWithRegistry.address,
      feeRecipient: constants.NULL_ADDRESS,
      makerToken: zrxAddress,
      takerToken: wEthAddress,
      makerTokenAmount: toSmallestUnits(2),
      takerTokenAmount: toSmallestUnits(2),
      makerFee: new BigNumber(0),
      takerFee: new BigNumber(0),
      expirationTimestampInSec: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
      salt: new BigNumber(0),
    };
    validOrder = new Order(validOrderParams);
    await validOrder.signAsync();

    [zrx, wEth] = await Promise.all([
      DummyToken.at(zrxAddress),
      DummyToken.at(wEthAddress),
    ]);
    dmyBalances = new Balances([zrx, wEth], [maker, taker]);
    await Promise.all([
      zrx.approve(Proxy.address, mul(validOrder.params.makerTokenAmount, 100), { from: maker }),
      zrx.setBalance(maker, mul(validOrder.params.makerTokenAmount, 100), { from: owner }),
    ]);
  });

  describe('init', () => {
    it('should throw when not called by owner', async () => {
      const params = validOrder.createFill();
      try {
        await crowdsaleWithRegistry.init(
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
        await crowdsaleWithRegistry.init(
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

    it('should throw if called with an invalid makerToken', async () => {
      const invalidOrderParams = {
        exchangeContractAddress: Exchange.address,
        maker,
        taker: constants.NULL_ADDRESS,
        feeRecipient: constants.NULL_ADDRESS,
        makerToken: invalidTokenAddress,
        takerToken: wEthAddress,
        makerTokenAmount: toSmallestUnits(5),
        takerTokenAmount: toSmallestUnits(5),
        makerFee: new BigNumber(0),
        takerFee: new BigNumber(0),
        expirationTimestampInSec: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
        salt: new BigNumber(0),
      };
      const newOrder = new Order(invalidOrderParams);
      await newOrder.signAsync();
      const params = newOrder.createFill();

      try {
        await crowdsaleWithRegistry.init(
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

    it('should throw if called with an invalid takerToken', async () => {
      const invalidOrderParams = {
        exchangeContractAddress: Exchange.address,
        maker,
        taker: constants.NULL_ADDRESS,
        feeRecipient: constants.NULL_ADDRESS,
        makerToken: zrxAddress,
        takerToken: invalidTokenAddress,
        makerTokenAmount: toSmallestUnits(5),
        takerTokenAmount: toSmallestUnits(5),
        makerFee: new BigNumber(0),
        takerFee: new BigNumber(0),
        expirationTimestampInSec: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
        salt: new BigNumber(0),
      };
      const newOrder = new Order(invalidOrderParams);
      await newOrder.signAsync();
      const params = newOrder.createFill();

      try {
        await crowdsaleWithRegistry.init(
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
      const invalidOrderParams = {
        exchangeContractAddress: Exchange.address,
        maker,
        taker: constants.NULL_ADDRESS,
        feeRecipient: constants.NULL_ADDRESS,
        makerToken: zrxAddress,
        takerToken: wEthAddress,
        makerTokenAmount: toSmallestUnits(5),
        takerTokenAmount: toSmallestUnits(5),
        makerFee: new BigNumber(0),
        takerFee: new BigNumber(0),
        expirationTimestampInSec: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
        salt: new BigNumber(0),
      };
      const invalidOrder = new Order(invalidOrderParams);
      await invalidOrder.signAsync();
      const params = invalidOrder.createFill();
      try {
        await crowdsaleWithRegistry.init(
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
      const res = await crowdsaleWithRegistry.init(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        { from: owner },
      );

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

      const isInitialized = await crowdsaleWithRegistry.isInitialized.call();
      assert.equal(isInitialized, true);
    });

    it('should throw if the sale has already been initialized', async () => {
      const params = validOrder.createFill();
      try {
        await crowdsaleWithRegistry.init(
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

  describe('registerAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        await crowdsaleWithRegistry.registerAddress(taker, { from: notOwner });
        throw new Error('registerAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should register an address if called by owner', async () => {
      await crowdsaleWithRegistry.registerAddress(taker, { from: owner });
      let isTakerRegistered = await crowdsaleWithRegistry.registered.call(taker);
      assert.equal(isTakerRegistered, true);

      await crowdsaleWithRegistry.deregisterAddress(taker, { from: owner });
      isTakerRegistered = await crowdsaleWithRegistry.registered.call(taker);
      assert.equal(isTakerRegistered, false);
    });
  });

  describe('registerAddresses', () => {
    it('should throw if not called by owner', async () => {
      try {
        await crowdsaleWithRegistry.registerAddresses([taker], { from: notOwner });
        throw new Error('registerAddresses succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should register addresses if called by owner', async () => {
      await crowdsaleWithRegistry.registerAddresses([maker, taker], { from: owner });
      let isMakerRegistered = await crowdsaleWithRegistry.registered.call(maker);
      let isTakerRegistered = await crowdsaleWithRegistry.registered.call(taker);
      assert.equal(isMakerRegistered, true);
      assert.equal(isTakerRegistered, true);

      await crowdsaleWithRegistry.deregisterAddresses([maker, taker], { from: owner });
      isMakerRegistered = await crowdsaleWithRegistry.registered.call(maker);
      isTakerRegistered = await crowdsaleWithRegistry.registered.call(taker);
      assert.equal(isMakerRegistered, false);
      assert.equal(isTakerRegistered, false);
    });
  });

  describe('deregisterAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        await crowdsaleWithRegistry.deregisterAddress(taker, { from: notOwner });
        throw new Error('deregisterAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should deregister an address if called by owner', async () => {
      await crowdsaleWithRegistry.registerAddress(taker, { from: owner });
      let isTakerRegistered = await crowdsaleWithRegistry.registered.call(taker);
      assert.equal(isTakerRegistered, true);
      await crowdsaleWithRegistry.deregisterAddress(taker, { from: owner });
      isTakerRegistered = await crowdsaleWithRegistry.registered.call(taker);
      assert.equal(isTakerRegistered, false);
    });
  });

  describe('deregisterAddresses', () => {
    it('should throw if not called by owner', async () => {
      try {
        await crowdsaleWithRegistry.deregisterAddresses([taker], { from: notOwner });
        throw new Error('deregisterAddresses succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should deregister addresses if called by owner', async () => {
      await crowdsaleWithRegistry.registerAddresses([maker, taker], { from: owner });
      let isMakerRegistered = await crowdsaleWithRegistry.registered.call(maker);
      let isTakerRegistered = await crowdsaleWithRegistry.registered.call(taker);
      assert.equal(isMakerRegistered, true);
      assert.equal(isTakerRegistered, true);

      await crowdsaleWithRegistry.deregisterAddresses([maker, taker], { from: owner });
      isMakerRegistered = await crowdsaleWithRegistry.registered.call(maker);
      isTakerRegistered = await crowdsaleWithRegistry.registered.call(taker);
      assert.equal(isMakerRegistered, false);
      assert.equal(isTakerRegistered, false);
    });
  });

  describe('setCapPerAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        const newCapPerAddress = web3Instance.toWei(1.1, 'ether');
        await crowdsaleWithRegistry.setCapPerAddress(newCapPerAddress, { from: notOwner });
        throw new Error('setCapPerAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should set a new capPerAddress if called by owner', async () => {
      const newCapPerAddress = new BigNumber(web3Instance.toWei(1.1, 'ether'));
      await crowdsaleWithRegistry.setCapPerAddress(newCapPerAddress, { from: owner });
      capPerAddress = await crowdsaleWithRegistry.capPerAddress.call();
      assert.equal(cmp(newCapPerAddress, capPerAddress), 0);
    });
  });

  describe('fillOrderWithEth', () => {
    beforeEach(async () => {
      crowdsaleWithRegistry = await CrowdsaleWithRegistry.new(
        Exchange.address,
        Proxy.address,
        zrxAddress,
        wEthAddress,
        capPerAddress,
        { from: owner },
      );
      await crowdsaleWithRegistry.registerAddress(taker, { from: owner });

      validOrderParams = {
        exchangeContractAddress: Exchange.address,
        maker,
        taker: crowdsaleWithRegistry.address,
        feeRecipient: constants.NULL_ADDRESS,
        makerToken: zrxAddress,
        takerToken: wEthAddress,
        makerTokenAmount: toSmallestUnits(5),
        takerTokenAmount: toSmallestUnits(5),
        makerFee: new BigNumber(0),
        takerFee: new BigNumber(0),
        expirationTimestampInSec: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
        salt: new BigNumber(0),
      };
      validOrder = new Order(validOrderParams);
      await validOrder.signAsync();
      const params = validOrder.createFill();

      await crowdsaleWithRegistry.init(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        { from: owner },
      );
    });

    it('should throw if sale not initialized', async () => {
      crowdsaleWithRegistry = await CrowdsaleWithRegistry.new(
        Exchange.address,
        Proxy.address,
        zrxAddress,
        wEthAddress,
        capPerAddress,
        { from: owner },
      );
      await crowdsaleWithRegistry.registerAddress(taker, { from: owner });
      try {
        const ethValue = new BigNumber(1);
        await crowdsaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
        });
        throw new Error('Fallback succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if the caller is not registered', async () => {
      await crowdsaleWithRegistry.deregisterAddress(taker, { from: owner });
      try {
        const ethValue = new BigNumber(1);
        await crowdsaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
        });
        throw new Error('Fallback succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should trade sent ETH for protocol tokens if sender is registered, ETH <= remaining order ETH and capPerAddress', async () => {
      const initBalances: BalancesByOwner = await dmyBalances.getAsync();
      const initTakerEthBalance = await getEthBalance(taker);

      const ethValue = web3Instance.toWei(1, 'ether');
      const zrxValue = div(mul(ethValue, validOrder.params.makerTokenAmount), validOrder.params.takerTokenAmount);
      const gasPrice = web3Instance.toWei(20, 'gwei');

      const res = await crowdsaleWithRegistry.fillOrderWithEth({
        from: taker,
        value: ethValue,
        gas: 300000,
        gasPrice,
      });

      const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
      const finalTakerEthBalance = await getEthBalance(taker);
      const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);

      assert.equal(finalBalances[maker][validOrder.params.makerToken],
                   sub(initBalances[maker][validOrder.params.makerToken], zrxValue));
      assert.equal(finalBalances[maker][validOrder.params.takerToken],
                   add(initBalances[maker][validOrder.params.takerToken], ethValue));
      assert.equal(finalBalances[taker][validOrder.params.makerToken],
                   add(initBalances[taker][validOrder.params.makerToken], zrxValue));
      assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, ethValue), ethSpentOnGas));
    });

    it('should fill the remaining capPerAddress if sender is registered and sent > than the remaining capPerAddress',
       async () => {
      const initBalances: BalancesByOwner = await dmyBalances.getAsync();
      const initTakerEthBalance = await getEthBalance(taker);
      const ethValue = add(capPerAddress, 1);
      const gasPrice = web3Instance.toWei(20, 'gwei');

      const res = await crowdsaleWithRegistry.fillOrderWithEth({
        from: taker,
        value: ethValue,
        gas: 300000,
        gasPrice,
      });

      const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
      const finalTakerEthBalance = await getEthBalance(taker);
      const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);
      const filledZrxValue = capPerAddress;
      const filledEthValue = capPerAddress;

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
      await crowdsaleWithRegistry.setCapPerAddress(newCapPerAddress, { from: owner });
      const initBalances: BalancesByOwner = await dmyBalances.getAsync();
      const initTakerEthBalance = await getEthBalance(taker);
      const remainingTakerTokenAmount = sub(validOrder.params.takerTokenAmount,
                                            await exchange.getUnavailableTakerTokenAmount(validOrder.params.orderHashHex));

      const ethValue = web3Instance.toWei(6, 'ether');
      const gasPrice = web3Instance.toWei(6, 'gwei');

      const res = await crowdsaleWithRegistry.fillOrderWithEth({
        from: taker,
        value: ethValue,
        gas: 300000,
        gasPrice,
      });
      const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
      const finalTakerEthBalance = await getEthBalance(taker);
      const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);
      const filledZrxValue = remainingTakerTokenAmount;
      const filledEthValue = div(mul(filledZrxValue, validOrder.params.makerTokenAmount), validOrder.params.takerTokenAmount);

      assert.equal(finalBalances[maker][validOrder.params.makerToken],
                   sub(initBalances[maker][validOrder.params.makerToken], filledZrxValue));
      assert.equal(finalBalances[maker][validOrder.params.takerToken],
                   add(initBalances[maker][validOrder.params.takerToken], filledEthValue));
      assert.equal(finalBalances[taker][validOrder.params.makerToken],
                   add(initBalances[taker][validOrder.params.makerToken], filledZrxValue));
      assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, filledEthValue), ethSpentOnGas));

      assert.equal(res.receipt.logs.length, 5);
      const isFinished = await crowdsaleWithRegistry.isFinished.call();
      assert.equal(isFinished, true);

      try {
        const ethValue = web3Instance.toWei(1, 'ether');
        await crowdsaleWithRegistry.fillOrderWithEth({
          from: taker,
          value: ethValue,
          gas: 300000,
        });
        throw new Error('Fallback succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('fallback', () => {
    beforeEach(async () => {
      crowdsaleWithRegistry = await CrowdsaleWithRegistry.new(
        Exchange.address,
        Proxy.address,
        zrxAddress,
        wEthAddress,
        capPerAddress,
        { from: owner },
      );
      await crowdsaleWithRegistry.registerAddress(taker, { from: owner });

      validOrderParams = {
        exchangeContractAddress: Exchange.address,
        maker,
        taker: crowdsaleWithRegistry.address,
        feeRecipient: constants.NULL_ADDRESS,
        makerToken: zrxAddress,
        takerToken: wEthAddress,
        makerTokenAmount: toSmallestUnits(5),
        takerTokenAmount: toSmallestUnits(5),
        makerFee: new BigNumber(0),
        takerFee: new BigNumber(0),
        expirationTimestampInSec: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
        salt: new BigNumber(0),
      };
      validOrder = new Order(validOrderParams);
      await validOrder.signAsync();
      const params = validOrder.createFill();

      await crowdsaleWithRegistry.init(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        { from: owner },
      );
    });

    it('should trade sent ETH for protocol tokens if sender is registered, ETH <= remaining order ETH and capPerAddress', async () => {
      const initBalances: BalancesByOwner = await dmyBalances.getAsync();
      const initTakerEthBalance = await getEthBalance(taker);

      const ethValue = web3Instance.toWei(1, 'ether');
      const zrxValue = div(mul(ethValue, validOrder.params.makerTokenAmount), validOrder.params.takerTokenAmount);
      const gasPrice = web3Instance.toWei(20, 'gwei');

      const txHash = await sendTransaction({
        from: taker,
        to: crowdsaleWithRegistry.address,
        value: ethValue,
        gas: 300000,
        gasPrice,
      });
      const receipt = await getTransactionReceipt(txHash);

      const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
      const finalTakerEthBalance = await getEthBalance(taker);
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
