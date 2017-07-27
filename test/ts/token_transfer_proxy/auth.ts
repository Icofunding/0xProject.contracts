import * as _ from 'lodash';
import * as assert from 'assert';
import { testUtil } from '../../../util/test_util';
import { ContractInstance } from '../../../util/types';

const TokenTransferProxy = artifacts.require('./db/TokenTransferProxy.sol');

contract('TokenTransferProxy', (accounts: string[]) => {
  const owner = accounts[0];
  const notOwner = accounts[1];

  let tokenTransferProxy: ContractInstance;
  let authorized: string;
  let notAuthorized = owner;

  before(async () => {
    tokenTransferProxy = await TokenTransferProxy.deployed();
  });

  describe('addAuthorizedAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        await tokenTransferProxy.addAuthorizedAddress(notOwner, { from: notOwner });
        throw new Error('addAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow owner to add an authorized address', async () => {
      await tokenTransferProxy.addAuthorizedAddress(notAuthorized, { from: owner });
      authorized = notAuthorized;
      notAuthorized = null;
      const isAuthorized = await tokenTransferProxy.authorized.call(authorized);
      assert(isAuthorized);
    });

    it('should throw if owner attempts to authorize a duplicate address', async () => {
      try {
        await tokenTransferProxy.addAuthorizedAddress(authorized, { from: owner });
        throw new Error('addAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('removeAuthorizedAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        await tokenTransferProxy.removeAuthorizedAddress(authorized, { from: notOwner });
        throw new Error('removeAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow owner to remove an authorized address', async () => {
      await tokenTransferProxy.removeAuthorizedAddress(authorized, { from: owner });
      notAuthorized = authorized;
      authorized = null;

      const isAuthorized = await tokenTransferProxy.authorized.call(notAuthorized);
      assert(!isAuthorized);
    });

    it('should throw if owner attempts to remove an address that is not authorized', async () => {
      try {
        await tokenTransferProxy.removeAuthorizedAddress(notAuthorized, { from: owner });
        throw new Error('removeAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('getAuthorizedAddresses', () => {
    it('should return all authorized addresses', async () => {
      const initial = await tokenTransferProxy.getAuthorizedAddresses();
      assert.equal(initial.length, 1);
      await tokenTransferProxy.addAuthorizedAddress(notAuthorized, { from: owner });

      authorized = notAuthorized;
      notAuthorized = null;
      const afterAdd = await tokenTransferProxy.getAuthorizedAddresses();
      assert.equal(afterAdd.length, 2);
      assert(_.includes(afterAdd, authorized));

      await tokenTransferProxy.removeAuthorizedAddress(authorized, { from: owner });
      notAuthorized = authorized;
      authorized = null;
      const afterRemove = await tokenTransferProxy.getAuthorizedAddresses();
      assert.equal(afterRemove.length, 1);
    });
  });
});
