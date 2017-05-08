import * as assert from 'assert';
import BigNumber = require('bignumber.js');
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

const { toSmallestUnits } = BNUtil;

contract('SimpleCrowdsale', (accounts: string[]) => {
  const maker = accounts[0];
  const taker = accounts[1];
  const owner = accounts[0];
  const notOwner = accounts[1];

  let tokenRegistry: ContractInstance;
  let simpleCrowdsale: ContractInstance;
  let zrx: ContractInstance;
  let wEth: ContractInstance;

  let order: Order;
  let balances: BalancesByOwner;
  let dmyBalances: Balances;

  before(async () => {
    [tokenRegistry, simpleCrowdsale] = await Promise.all([
      TokenRegistry.deployed(),
      SimpleCrowdsale.deployed(),
    ]);
    const [zrxAddress, wEthAddress] = await Promise.all([
      tokenRegistry.getTokenAddressBySymbol('ZRX'),
      tokenRegistry.getTokenAddressBySymbol('WETH'),
    ]);

    const orderParams = {
      exchange: Exchange.address,
      maker,
      taker: constants.NULL_ADDRESS,
      feeRecipient: constants.NULL_ADDRESS,
      tokenM: zrxAddress,
      tokenT: wEthAddress,
      valueM: toSmallestUnits(100),
      valueT: toSmallestUnits(100),
      feeM: new BigNumber(0),
      feeT: new BigNumber(0),
      expiration: new BigNumber(Math.floor(Date.now() / 1000) + 86400),
      salt: new BigNumber(0),
    };
    order = new Order(orderParams);
    await order.signAsync();

    [zrx, wEth] = await Promise.all([
      DummyToken.at(zrxAddress),
      DummyToken.at(wEthAddress),
    ]);
    dmyBalances = new Balances([zrx, wEth], [maker]);
    await Promise.all([
      zrx.approve(Proxy.address, order.params.valueM, { from: maker }),
      zrx.setBalance(maker, order.params.valueM, { from: owner }),
    ]);
  });

  describe('init', () => {
    it('should throw when not called by owner', async () => {
      try {
        await simpleCrowdsale.init(
          [order.params.maker, order.params.taker],
          [order.params.tokenM, order.params.tokenT],
          order.params.feeRecipient,
          [order.params.valueM, order.params.valueT],
          [order.params.feeM, order.params.feeT],
          [order.params.expiration, order.params.salt],
          order.params.v,
          [order.params.r, order.params.s],
          { from: notOwner },
        );
        throw new Error('Init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if called with an invalid order', async () => {
      try {
        const invalidR = ethUtil.bufferToHex(ethUtil.sha3('invalidR'));
        await simpleCrowdsale.init(
          [order.params.maker, order.params.taker],
          [order.params.tokenM, order.params.tokenT],
          order.params.feeRecipient,
          [order.params.valueM, order.params.valueT],
          [order.params.feeM, order.params.feeT],
          [order.params.expiration, order.params.salt],
          order.params.v,
          [invalidR, order.params.s],
        );
        throw new Error('Init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should initialize the sale if called by owner with a valid order', async () => {
      await simpleCrowdsale.init(
        [order.params.maker, order.params.taker],
        [order.params.tokenM, order.params.tokenT],
        order.params.feeRecipient,
        [order.params.valueM, order.params.valueT],
        [order.params.feeM, order.params.feeT],
        [order.params.expiration, order.params.salt],
        order.params.v,
        [order.params.r, order.params.s],
        { from: owner },
      );
      const isInitialized = await simpleCrowdsale.isInitialized.call();
      assert(isInitialized);
    });

    it('should throw if the sale has already been initialized', async () => {
      try {
        await simpleCrowdsale.init(
          [order.params.maker, order.params.taker],
          [order.params.tokenM, order.params.tokenT],
          order.params.feeRecipient,
          [order.params.valueM, order.params.valueT],
          [order.params.feeM, order.params.feeT],
          [order.params.expiration, order.params.salt],
          order.params.v,
          [order.params.r, order.params.s],
          { from: owner },
        );
        throw new Error('Init succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });
});
