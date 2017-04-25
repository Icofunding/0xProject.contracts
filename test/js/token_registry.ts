import * as _ from 'lodash';
import { testUtil } from '../../util/test_util';
import { TokenRegWrapper } from '../../util/token_registry_wrapper';
import { ContractInstance } from '../../util/types';
import * as assert from 'assert';
import ethUtil = require('ethereumjs-util');

const TokenRegistry = artifacts.require('./TokenRegistry.sol');

contract('TokenRegistry', (accounts: string[]) => {
  const owner = accounts[0];
  const notOwner = accounts[1];

  const token = {
    tokenAddress: `0x${ethUtil.setLength(ethUtil.toBuffer('0x1'), 20).toString('hex')}`,
    name: 'testToken',
    symbol: 'TT',
    url: 'www.test.com',
    decimals: 18,
    ipfsHash: `0x${ethUtil.sha3('test1').toString('hex')}`,
    swarmHash: `0x${ethUtil.sha3('test2').toString('hex')}`,
  };

  const nullToken = {
    tokenAddress: `0x${ethUtil.setLengthLeft(ethUtil.toBuffer('0x0'), 20).toString('hex')}`,
    name: '',
    symbol: '',
    url: '',
    decimals: 0,
    ipfsHash: `0x${ethUtil.setLengthLeft(ethUtil.toBuffer('0x0'), 32).toString('hex')}`,
    swarmHash: `0x${ethUtil.setLengthLeft(ethUtil.toBuffer('0x0'), 32).toString('hex')}`,
  };

  let tokenReg: ContractInstance;
  let tokenRegWrapper: TokenRegWrapper;

  before(async () => {
    tokenReg = await TokenRegistry.deployed();
    tokenRegWrapper = new TokenRegWrapper(tokenReg);
  });

  describe('addToken', () => {
    it('should throw when not called by owner', async () => {
      try {
        await tokenRegWrapper.addTokenAsync(token, notOwner);
        throw new Error('addToken succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should add token metadata when called by owner', async () => {
      await tokenRegWrapper.addTokenAsync(token, owner);
      const tokenData = await tokenRegWrapper.getTokenMetaDataAsync(token.tokenAddress);
      assert.deepEqual(tokenData, token);
    });
  });

  describe('getTokenByName', () => {
    it('should return token metadata when given the token name', async () => {
      const tokenData = await tokenRegWrapper.getTokenByNameAsync(token.name);
      assert.deepEqual(tokenData, token);
    });
  });

  describe('getTokenBySymbol', () => {
    it('should return token metadata when given the token symbol', async () => {
      const tokenData = await tokenRegWrapper.getTokenBySymbolAsync(token.symbol);
      assert.deepEqual(tokenData, token);
    });
  });

  const newNameToken = _.assign({}, token, { name: 'newName' });
  describe('setTokenName', () => {
    it('should throw when not called by owner', async () => {
      try {
        await tokenReg.setTokenName(token.tokenAddress, newNameToken.name, { from: notOwner });
        throw new Error('setTokenName succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should change the token name when called by owner', async () => {
      const res = await tokenReg.setTokenName(newNameToken.tokenAddress, newNameToken.name, { from: owner });
      assert.equal(res.logs.length, 1);
      const [newData, oldData] = await Promise.all([
        tokenRegWrapper.getTokenByNameAsync(newNameToken.name),
        tokenRegWrapper.getTokenByNameAsync(token.name),
      ]);
      assert.deepEqual(newData, newNameToken);
      assert.deepEqual(oldData, nullToken);
    });
  });

  const newSymbolToken = _.assign({}, newNameToken, { symbol: 'newSymbol' });
  describe('setTokenSymbol', () => {
    it('should throw when not called by owner', async () => {
      try {
        await tokenReg.setTokenSymbol(token.tokenAddress, newSymbolToken.symbol, { from: notOwner });
        throw new Error('setTokenSymbol succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should change the token symbol when called by owner', async () => {
      const res = await tokenReg.setTokenSymbol(newSymbolToken.tokenAddress, newSymbolToken.symbol, { from: owner });
      assert.equal(res.logs.length, 1);
      const [newData, oldData] = await Promise.all([
        tokenRegWrapper.getTokenBySymbolAsync(newSymbolToken.symbol),
        tokenRegWrapper.getTokenBySymbolAsync(token.symbol),
      ]);
      assert.deepEqual(newData, newSymbolToken);
      assert.deepEqual(oldData, nullToken);
    });
  });

  describe('removeToken', () => {
    it('should throw if not called by owner', async () => {
      try {
        await tokenReg.removeToken(token.tokenAddress, { from: notOwner });
        throw new Error('removeToken succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should remove token metadata when called by owner', async () => {
      const res = await tokenReg.removeToken(token.tokenAddress, { from: owner });
      assert.equal(res.logs.length, 1);
      const tokenData = await tokenRegWrapper.getTokenMetaDataAsync(token.tokenAddress);
      assert.deepEqual(tokenData, nullToken);
    });
  });
});
