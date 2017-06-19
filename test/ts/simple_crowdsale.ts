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
  SimpleCrowdsale,
  TokenRegistry,
  Exchange,
  DummyToken,
  Proxy,
} = new Artifacts(artifacts);

const { add, sub, mul, div, cmp, toSmallestUnits } = BNUtil;

// In order to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
// with type `any` to a variable of type `Web3`.
const web3Instance: Web3 = web3;

contract('SimpleCrowdsale', (accounts: string[]) => {
  const maker = accounts[0];
  const taker = accounts[1];
  const owner = accounts[0];
  const notOwner = accounts[1];

  let tokenRegistry: ContractInstance;
  let simpleCrowdsale: ContractInstance;
  let exchange: ContractInstance;
  let zrx: ContractInstance;
  let wEth: ContractInstance;

  let invalidTokenAddress: string;
  let zrxAddress: string;
  let wEthAddress: string;

  let order: Order;
  let dmyBalances: Balances;

  const sendTransaction = promisify(web3Instance.eth.sendTransaction);
  const getEthBalance = promisify(web3Instance.eth.getBalance);
  const getTransactionReceipt = promisify(web3Instance.eth.getTransactionReceipt);

  before(async () => {
    [tokenRegistry, simpleCrowdsale, exchange] = await Promise.all([
      TokenRegistry.deployed(),
      SimpleCrowdsale.deployed(),
      Exchange.deployed(),
    ]);
    [zrxAddress, wEthAddress, invalidTokenAddress] = await Promise.all([
      tokenRegistry.getTokenAddressBySymbol('ZRX'),
      tokenRegistry.getTokenAddressBySymbol('WETH'),
      tokenRegistry.getTokenAddressBySymbol('REP'),
    ]);

    const orderParams = {
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
    order = new Order(orderParams);
    await order.signAsync();

    [zrx, wEth] = await Promise.all([
      DummyToken.at(zrxAddress),
      DummyToken.at(wEthAddress),
    ]);
    dmyBalances = new Balances([zrx, wEth], [maker, taker]);
    await Promise.all([
      zrx.approve(Proxy.address, order.params.makerTokenAmount, { from: maker }),
      zrx.setBalance(maker, order.params.makerTokenAmount, { from: owner }),
    ]);
  });

  describe('fallback', () => {
    it('should throw if sale not initialized', async () => {
      try {
        const ethValue = web3Instance.toWei(1, 'ether');
        await sendTransaction({
          from: taker,
          to: simpleCrowdsale.address,
          value: ethValue,
          gas: 300000,
        });
        throw new Error('Fallback succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('init', () => {
    it('should throw when not called by owner', async () => {
      const params = order.createFill();
      try {
        await simpleCrowdsale.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          { from: notOwner },
        );
        throw new Error('Init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if called with an invalid order signature', async () => {
      try {
        const params = order.createFill();
        const invalidR = ethUtil.bufferToHex(ethUtil.sha3('invalidR'));
        await simpleCrowdsale.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          invalidR,
          params.s,
        );
        throw new Error('Init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if called with an invalid makerToken', async () => {
      const orderParams = {
        exchangeContractAddress: Exchange.address,
        maker,
        taker: constants.NULL_ADDRESS,
        feeRecipient: constants.NULL_ADDRESS,
        makerToken: invalidTokenAddress,
        takerToken: wEthAddress,
        makerTokenAmount: toSmallestUnits(10),
        takerTokenAmount: toSmallestUnits(10),
        makerFee: new BigNumber(0),
        takerFee: new BigNumber(0),
        expirationTimestampInSec: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
        salt: new BigNumber(0),
      };
      const newOrder = new Order(orderParams);
      await newOrder.signAsync();
      const params = newOrder.createFill();

      try {
        await simpleCrowdsale.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
        );
        throw new Error('Init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if called with an invalid takerToken', async () => {
      const orderParams = {
        exchangeContractAddress: Exchange.address,
        maker,
        taker: constants.NULL_ADDRESS,
        feeRecipient: constants.NULL_ADDRESS,
        makerToken: zrxAddress,
        takerToken: invalidTokenAddress,
        makerTokenAmount: toSmallestUnits(10),
        takerTokenAmount: toSmallestUnits(10),
        makerFee: new BigNumber(0),
        takerFee: new BigNumber(0),
        expirationTimestampInSec: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
        salt: new BigNumber(0),
      };
      const newOrder = new Order(orderParams);
      await newOrder.signAsync();
      const params = newOrder.createFill();

      try {
        await simpleCrowdsale.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
        );
        throw new Error('Init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should initialize the sale if called by owner with a valid order', async () => {
      const params = order.createFill();
      await simpleCrowdsale.init(
        params.orderAddresses,
        params.orderValues,
        params.v,
        params.r,
        params.s,
        { from: owner },
      );
      const isInitialized = await simpleCrowdsale.isInitialized.call();
      assert.equal(isInitialized, true);
    });

    it('should throw if the sale has already been initialized', async () => {
      const params = order.createFill();
      try {
        await simpleCrowdsale.init(
          params.orderAddresses,
          params.orderValues,
          params.v,
          params.r,
          params.s,
          { from: owner },
        );
        throw new Error('Init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('fallback', () => {
    it('should trade sent ETH for protocol tokens if ETH <= remaining order ETH', async () => {
      const initBalances: BalancesByOwner = await dmyBalances.getAsync();
      const initTakerEthBalance = await getEthBalance(taker);

      const ethValue = web3Instance.toWei(1, 'ether');
      const zrxValue = div(mul(ethValue, order.params.makerTokenAmount), order.params.takerTokenAmount);
      const gasPrice = web3Instance.toWei(20, 'gwei');

      const txHash = await sendTransaction({
        from: taker,
        to: simpleCrowdsale.address,
        value: ethValue,
        gas: 300000,
        gasPrice,
      });
      const receipt = await getTransactionReceipt(txHash);

      const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
      const finalTakerEthBalance = await getEthBalance(taker);
      const ethSpentOnGas = mul(receipt.gasUsed, gasPrice);

      assert.equal(finalBalances[maker][order.params.makerToken],
                   sub(initBalances[maker][order.params.makerToken], zrxValue));
      assert.equal(finalBalances[maker][order.params.takerToken],
                   add(initBalances[maker][order.params.takerToken], ethValue));
      assert.equal(finalBalances[taker][order.params.makerToken],
                   add(initBalances[taker][order.params.makerToken], zrxValue));
      assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, ethValue), ethSpentOnGas));
    });

    it('should partial fill and end sale if sent ETH > remaining order ETH', async () => {
      const initBalances: BalancesByOwner = await dmyBalances.getAsync();
      const initTakerEthBalance = await getEthBalance(taker);
      const remainingtakerTokenAmount = sub(order.params.takerTokenAmount,
                                            await exchange.getUnavailableTakerTokenAmount(order.params.orderHashHex));

      const ethValueSent = web3Instance.toWei(20, 'ether');
      const gasPrice = web3Instance.toWei(20, 'gwei');

      const txHash = await sendTransaction({
        from: taker,
        to: simpleCrowdsale.address,
        value: ethValueSent,
        gas: 300000,
        gasPrice,
      });
      const receipt = await getTransactionReceipt(txHash);

      const finalBalances: BalancesByOwner = await dmyBalances.getAsync();
      const finalTakerEthBalance = await getEthBalance(taker);
      const ethSpentOnGas = mul(receipt.gasUsed, gasPrice);
      const zrxValue = remainingtakerTokenAmount;
      const ethValue = div(mul(zrxValue, order.params.makerTokenAmount), order.params.takerTokenAmount);

      assert.equal(finalBalances[maker][order.params.makerToken],
                   sub(initBalances[maker][order.params.makerToken], zrxValue));
      assert.equal(finalBalances[maker][order.params.takerToken],
                   add(initBalances[maker][order.params.takerToken], ethValue));
      assert.equal(finalBalances[taker][order.params.makerToken],
                   add(initBalances[taker][order.params.makerToken], zrxValue));
      assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, ethValue), ethSpentOnGas));

      const isFinished = await simpleCrowdsale.isFinished.call();
      assert.equal(isFinished, true);
    });

    it('should throw if sale finished', async () => {
      try {
        const ethValue = web3Instance.toWei(1, 'ether');
        await sendTransaction({
          from: taker,
          to: simpleCrowdsale.address,
          value: ethValue,
          gas: 300000,
        });
        throw new Error('Fallback succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });
});
