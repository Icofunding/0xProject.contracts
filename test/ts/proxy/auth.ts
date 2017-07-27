import * as _ from 'lodash';
import * as assert from 'assert';
import { testUtil } from '../../../util/test_util';
import { ContractInstance } from '../../../util/types';

const TokenProxy = artifacts.require('./db/TokenProxy.sol');

contract('TokenProxy', (accounts: string[]) => {
  const owner = accounts[0];
  const notOwner = accounts[1];

  let tokenProxy: ContractInstance;
  let authorized: string;
  let notAuthorized = owner;

  before(async () => {
    tokenProxy = await TokenProxy.deployed();
  });

  describe('addAuthorizedAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        await tokenProxy.addAuthorizedAddress(notOwner, { from: notOwner });
        throw new Error('addAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow owner to add an authorized address', async () => {
      await tokenProxy.addAuthorizedAddress(notAuthorized, { from: owner });
      authorized = notAuthorized;
      notAuthorized = null;
      const isAuthorized = await tokenProxy.authorized.call(authorized);
      assert(isAuthorized);
    });

    it('should throw if owner attempts to authorize a duplicate address', async () => {
      try {
        await tokenProxy.addAuthorizedAddress(authorized, { from: owner });
        throw new Error('addAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('removeAuthorizedAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        await tokenProxy.removeAuthorizedAddress(authorized, { from: notOwner });
        throw new Error('removeAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow owner to remove an authorized address', async () => {
      await tokenProxy.removeAuthorizedAddress(authorized, { from: owner });
      notAuthorized = authorized;
      authorized = null;

      const isAuthorized = await tokenProxy.authorized.call(notAuthorized);
      assert(!isAuthorized);
    });

    it('should throw if owner attempts to remove an address that is not authorized', async () => {
      try {
        await tokenProxy.removeAuthorizedAddress(notAuthorized, { from: owner });
        throw new Error('removeAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });

  describe('getAuthorizedAddresses', () => {
    it('should return all authorized addresses', async () => {
      const initial = await tokenProxy.getAuthorizedAddresses();
      assert.equal(initial.length, 1);
      await tokenProxy.addAuthorizedAddress(notAuthorized, { from: owner });

      authorized = notAuthorized;
      notAuthorized = null;
      const afterAdd = await tokenProxy.getAuthorizedAddresses();
      assert.equal(afterAdd.length, 2);
      assert(_.includes(afterAdd, authorized));

      await tokenProxy.removeAuthorizedAddress(authorized, { from: owner });
      notAuthorized = authorized;
      authorized = null;
      const afterRemove = await tokenProxy.getAuthorizedAddresses();
      assert.equal(afterRemove.length, 1);
    });
  });
});
