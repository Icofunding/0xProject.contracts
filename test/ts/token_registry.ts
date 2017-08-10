import * as _ from 'lodash';
import * as assert from 'assert';
import ethUtil = require('ethereumjs-util');
import { testUtil } from '../../util/test_util';
import { TokenRegWrapper } from '../../util/token_registry_wrapper';
import { ContractInstance } from '../../util/types';
import { Artifacts } from '../../util/artifacts';
import { constants } from '../../util/constants';

const { TokenRegistry } = new Artifacts(artifacts);

contract('TokenRegistry', (accounts: string[]) => {
  const owner = accounts[0];
  const notOwner = accounts[1];

  const tokenAddress1 = `0x${ethUtil.setLength(ethUtil.toBuffer('0x1'), 20).toString('hex')}`;
  const tokenAddress2 = `0x${ethUtil.setLength(ethUtil.toBuffer('0x2'), 20).toString('hex')}`;

  const token1 = {
    address: tokenAddress1,
    name: 'testToken1',
    symbol: 'TT1',
    decimals: 18,
    ipfsHash: `0x${ethUtil.sha3('ipfs1').toString('hex')}`,
    swarmHash: `0x${ethUtil.sha3('swarm1').toString('hex')}`,
  };

  const token2 = {
    address: tokenAddress2,
    name: 'testToken2',
    symbol: 'TT2',
    decimals: 18,
    ipfsHash: `0x${ethUtil.sha3('ipfs2').toString('hex')}`,
    swarmHash: `0x${ethUtil.sha3('swarm2').toString('hex')}`,
  };

  const nullToken = {
    address: constants.NULL_ADDRESS,
    name: '',
    symbol: '',
    decimals: 0,
    ipfsHash: constants.NULL_BYTES,
    swarmHash: constants.NULL_BYTES,
  };

  let tokenReg: ContractInstance;
  let tokenRegWrapper: TokenRegWrapper;

  beforeEach(async () => {
    tokenReg = await TokenRegistry.new();
    tokenRegWrapper = new TokenRegWrapper(tokenReg);
  });

  describe('addToken', () => {
    it('should throw when not called by owner', async () => {
      try {
        await tokenRegWrapper.addTokenAsync(token1, notOwner);
        throw new Error('addToken succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should add token metadata when called by owner', async () => {
      await tokenRegWrapper.addTokenAsync(token1, owner);
      const tokenData = await tokenRegWrapper.getTokenMetaDataAsync(token1.address);
      assert.deepEqual(tokenData, token1);
    });

    it('should throw if token already exists', async () => {
      await tokenRegWrapper.addTokenAsync(token1, owner);

      try {
        await tokenRegWrapper.addTokenAsync(token1, owner);
        throw new Error('addToken succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if token address is null', async () => {
      try {
        await tokenRegWrapper.addTokenAsync(nullToken, owner);
        throw new Error('addToken succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if name already exists', async () => {
      await tokenRegWrapper.addTokenAsync(token1, owner);
      const duplicateNameToken = _.assign({}, token2, { name: token1.name });

      try {
        await tokenRegWrapper.addTokenAsync(duplicateNameToken, owner);
        throw new Error('addToken succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if symbol already exists', async () => {
      await tokenRegWrapper.addTokenAsync(token1, owner);
      const duplicateSymbolToken = _.assign({}, token2, { symbol: token1.symbol });

      try {
        await tokenRegWrapper.addTokenAsync(duplicateSymbolToken, owner);
        throw new Error('addToken succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('after addToken', () => {
    beforeEach(async () => {
      await tokenRegWrapper.addTokenAsync(token1, owner);
    });

    describe('getTokenByName', () => {
      it('should return token metadata when given the token name', async () => {
        const tokenData = await tokenRegWrapper.getTokenByNameAsync(token1.name);
        assert.deepEqual(tokenData, token1);
      });
    });

    describe('getTokenBySymbol', () => {
      it('should return token metadata when given the token symbol', async () => {
        const tokenData = await tokenRegWrapper.getTokenBySymbolAsync(token1.symbol);
        assert.deepEqual(tokenData, token1);
      });

    });

    describe('setTokenName', () => {
      it('should throw when not called by owner', async () => {
        try {
          await tokenReg.setTokenName(token1.address, token2.name, { from: notOwner });
          throw new Error('setTokenName succeeded when it should have thrown');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

      it('should change the token name when called by owner', async () => {
        const res = await tokenReg.setTokenName(token1.address, token2.name, { from: owner });
        assert.equal(res.logs.length, 1);
        const [newData, oldData] = await Promise.all([
          tokenRegWrapper.getTokenByNameAsync(token2.name),
          tokenRegWrapper.getTokenByNameAsync(token1.name),
        ]);

        const expectedNewData = _.assign({}, token1, { name: token2.name });
        const expectedOldData = nullToken;
        assert.deepEqual(newData, expectedNewData);
        assert.deepEqual(oldData, expectedOldData);
      });

      it('should throw if the name already exists', async () => {
        await tokenRegWrapper.addTokenAsync(token2, owner);

        try {
          await tokenReg.setTokenName(token1.address, token2.name, { from: owner });
          throw new Error('setTokenName succeeded when it should have failed');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

      it('should throw if token does not exist', async () => {
        try {
          await tokenReg.setTokenName(nullToken.address, token2.name, { from: owner });
          throw new Error('setTokenName succeeded when it should have failed');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });
    });

    describe('setTokenSymbol', () => {
      it('should throw when not called by owner', async () => {
        try {
          await tokenReg.setTokenSymbol(token1.address, token2.symbol, { from: notOwner });
          throw new Error('setTokenSymbol succeeded when it should have thrown');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

      it('should change the token symbol when called by owner', async () => {
        const res = await tokenReg.setTokenSymbol(token1.address, token2.symbol, { from: owner });
        assert.equal(res.logs.length, 1);
        const [newData, oldData] = await Promise.all([
          tokenRegWrapper.getTokenBySymbolAsync(token2.symbol),
          tokenRegWrapper.getTokenBySymbolAsync(token1.symbol),
        ]);

        const expectedNewData = _.assign({}, token1, { symbol: token2.symbol });
        const expectedOldData = nullToken;
        assert.deepEqual(newData, expectedNewData);
        assert.deepEqual(oldData, expectedOldData);
      });

      it('should throw if the symbol already exists', async () => {
        await tokenRegWrapper.addTokenAsync(token2, owner);

        try {
          await tokenReg.setTokenSymbol(token1.address, token2.symbol, { from: owner });
          throw new Error('setTokenSymbol succeeded when it should have failed');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

      it('should throw if token does not exist', async () => {
        try {
          await tokenReg.setTokenSymbol(nullToken.address, token2.symbol, { from: owner });
          throw new Error('setTokenSymbol succeeded when it should have failed');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });
    });

    describe('removeToken', () => {
      it('should throw if not called by owner', async () => {
        const index = 0;
        try {
          await tokenReg.removeToken(token1.address, index, { from: notOwner });
          throw new Error('removeToken succeeded when it should have thrown');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

      it('should remove token metadata when called by owner', async () => {
        const index = 0;
        const res = await tokenReg.removeToken(token1.address, index, { from: owner });
        assert.equal(res.logs.length, 1);
        const tokenData = await tokenRegWrapper.getTokenMetaDataAsync(token1.address);
        assert.deepEqual(tokenData, nullToken);
      });

      it('should throw if token does not exist', async () => {
        const index = 0;
        try {
          await tokenReg.removeToken(nullToken.address, index, { from: owner });
          throw new Error('removeToken succeeded when it should have failed');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

      it('should throw if token at given index does not match address', async () => {
        await tokenRegWrapper.addTokenAsync(token2, owner);
        const incorrectIndex = 0;
        try {
          await tokenReg.removeToken(token2.address, incorrectIndex, { from: owner });
          throw new Error('removeToken succeeded when it should have failed');
        } catch (err) {
          testUtil.assertThrow(err);
        }
      });

    });
  });
});
