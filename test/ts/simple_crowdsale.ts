import * as assert from 'assert';
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

  const sendTransaction = promisify(web3.eth.sendTransaction);
  const getEthBalance = promisify(web3.eth.getBalance);
  const getTransactionReceipt = promisify(web3.eth.getTransactionReceipt);

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
      exchange: Exchange.address,
      maker,
      taker: constants.NULL_ADDRESS,
      feeRecipient: constants.NULL_ADDRESS,
      tokenM: zrxAddress,
      tokenT: wEthAddress,
      valueM: toSmallestUnits(10),
      valueT: toSmallestUnits(10),
      feeM: new BigNumber(0),
      feeT: new BigNumber(0),
      expiration: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
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
      zrx.approve(Proxy.address, order.params.valueM, { from: maker }),
      zrx.setBalance(maker, order.params.valueM, { from: owner }),
    ]);
  });

  describe('fallback', () => {
    it('should throw if sale not initialized', async () => {
      try {
        const ethValue = web3.toWei(1, 'ether');
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

    it('should throw if called with an invalid tokenM', async () => {
      const orderParams = {
        exchange: Exchange.address,
        maker,
        taker: constants.NULL_ADDRESS,
        feeRecipient: constants.NULL_ADDRESS,
        tokenM: invalidTokenAddress,
        tokenT: wEthAddress,
        valueM: toSmallestUnits(10),
        valueT: toSmallestUnits(10),
        feeM: new BigNumber(0),
        feeT: new BigNumber(0),
        expiration: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
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

    it('should throw if called with an invalid tokenT', async () => {
      const orderParams = {
        exchange: Exchange.address,
        maker,
        taker: constants.NULL_ADDRESS,
        feeRecipient: constants.NULL_ADDRESS,
        tokenM: zrxAddress,
        tokenT: invalidTokenAddress,
        valueM: toSmallestUnits(10),
        valueT: toSmallestUnits(10),
        feeM: new BigNumber(0),
        feeT: new BigNumber(0),
        expiration: new BigNumber(Math.floor(Date.now() / 1000) + 1000000000),
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

      const ethValue = web3.toWei(1, 'ether');
      const zrxValue = div(mul(ethValue, order.params.valueM), order.params.valueT);
      const gasPrice = web3.toWei(20, 'gwei');

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

      assert.equal(finalBalances[maker][order.params.tokenM],
                   sub(initBalances[maker][order.params.tokenM], zrxValue));
      assert.equal(finalBalances[maker][order.params.tokenT],
                   add(initBalances[maker][order.params.tokenT], ethValue));
      assert.equal(finalBalances[taker][order.params.tokenM],
                   add(initBalances[taker][order.params.tokenM], zrxValue));
      assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, ethValue), ethSpentOnGas));
    });

    it('should partial fill and end sale if sent ETH > remaining order ETH', async () => {
      const initBalances: BalancesByOwner = await dmyBalances.getAsync();
      const initTakerEthBalance = await getEthBalance(taker);
      const remainingValueT = sub(order.params.valueT, await exchange.getUnavailableValueT(order.params.orderHashHex));

      const ethValueSent = web3.toWei(20, 'ether');
      const gasPrice = web3.toWei(20, 'gwei');

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
      const zrxValue = remainingValueT;
      const ethValue = div(mul(zrxValue, order.params.valueM), order.params.valueT);

      assert.equal(finalBalances[maker][order.params.tokenM],
                   sub(initBalances[maker][order.params.tokenM], zrxValue));
      assert.equal(finalBalances[maker][order.params.tokenT],
                   add(initBalances[maker][order.params.tokenT], ethValue));
      assert.equal(finalBalances[taker][order.params.tokenM],
                   add(initBalances[taker][order.params.tokenM], zrxValue));
      assert.equal(finalTakerEthBalance, sub(sub(initTakerEthBalance, ethValue), ethSpentOnGas));

      const isFinished = await simpleCrowdsale.isFinished.call();
      assert.equal(isFinished, true);
    });

    it('should throw if sale finished', async () => {
      try {
        const ethValue = web3.toWei(1, 'ether');
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
