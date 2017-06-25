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

// In order to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
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

  let zrxAddress: string;
  let wEthAddress: string;

  let validOrder: Order;
  let dmyBalances: Balances;

  const sendTransaction = promisify(web3Instance.eth.sendTransaction);
  const getEthBalance = promisify(web3Instance.eth.getBalance);
  const getTransactionReceipt = promisify(web3Instance.eth.getTransactionReceipt);

  before(async () => {
    [exchange, tokenRegistry] = await Promise.all([
      Exchange.deployed(),
      TokenRegistry.deployed(),
    ]);
    [zrxAddress, wEthAddress] = await Promise.all([
      tokenRegistry.getTokenAddressBySymbol('ZRX'),
      tokenRegistry.getTokenAddressBySymbol('WETH'),
    ]);
    crowdsaleWithRegistry = await CrowdsaleWithRegistry.new(
      Exchange.address,
      Proxy.address,
      zrxAddress,
      wEthAddress,
      capPerAddress,
    );
    const validOrderParams = {
      exchangeContractAddress: Exchange.address,
      maker,
      taker: crowdsaleWithRegistry.address,
      feeRecipient: constants.NULL_ADDRESS,
      makerToken: zrxAddress,
      takerToken: wEthAddress,
      makerTokenAmount: toSmallestUnits(10),
      takerTokenAmount: toSmallestUnits(10),
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
      zrx.approve(Proxy.address, validOrder.params.makerTokenAmount, { from: maker }),
      zrx.setBalance(maker, validOrder.params.makerTokenAmount, { from: owner }),
    ]);
  });

  describe('init', () => {
    it('should throw if the order taker is not the crowdsale contract address', async () => {
      const invalidOrderParams = {
        exchangeContractAddress: Exchange.address,
        maker,
        taker: constants.NULL_ADDRESS,
        feeRecipient: constants.NULL_ADDRESS,
        makerToken: zrxAddress,
        takerToken: wEthAddress,
        makerTokenAmount: toSmallestUnits(10),
        takerTokenAmount: toSmallestUnits(10),
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

    it('should initialize the sale with valid order params', async () => {
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

  describe('fallback', () => {
    it('should throw if the caller is not registered', async () => {
      try {
        const valueToSend = new BigNumber(1);
        await sendTransaction({
          from: taker,
          to: crowdsaleWithRegistry.address,
          value: valueToSend,
        });
        throw new Error('Fallback succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should fill the remaining capPerAddress if sender is registered and sent > than the remaining capPerAddress',
       async () => {
      await crowdsaleWithRegistry.registerAddress(taker, { from: owner });

      const initBalances: BalancesByOwner = await dmyBalances.getAsync();
      const initTakerEthBalance = await getEthBalance(taker);
      const valueToSend = add(capPerAddress, 1);
      const gasPrice = web3Instance.toWei(20, 'gwei');

      const txHash = await sendTransaction({
        from: taker,
        to: crowdsaleWithRegistry.address,
        value: valueToSend,
        gas: 300000,
        gasPrice,
      });

      const receipt = await getTransactionReceipt(txHash);

      const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
      const finalTakerEthBalance = await getEthBalance(taker);
      const ethSpentOnGas = mul(receipt.gasUsed, gasPrice);
      const zrxValue = capPerAddress;
      const ethValue = capPerAddress;

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
