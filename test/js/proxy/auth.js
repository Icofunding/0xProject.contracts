require('babel-polyfill');
require('source-map-support/register');

const Proxy = artifacts.require('./db/Proxy.sol');
const assert = require('assert');
const testUtil = require('../../../util/testUtil');

contract('Proxy', accounts => {
  const owner = accounts[0];
  const notOwner = accounts[1];

  let proxy;
  let authorized;
  let notAuthorized = owner;

  before(async () => {
    proxy = await Proxy.deployed();
  });

  describe('addAuthorizedAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        await proxy.addAuthorizedAddress(notOwner, { from: notOwner });
        throw new Error('addAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow owner to add an authorized address', async () => {
      await proxy.addAuthorizedAddress(notAuthorized, { from: owner });
      authorized = notAuthorized;
      notAuthorized = null;
      const isAuthorized = await proxy.authorized.call(authorized);
      assert(isAuthorized);
    });
  });

  describe('removeAuthorizedAddress', () => {
    it('should throw if not called by owner', async () => {
      try {
        await proxy.removeAuthorizedAddress(authorized, { from: notOwner });
        throw new Error('removeAuthorizedAddress succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow owner to remove an authorized address', async () => {
      await proxy.removeAuthorizedAddress(authorized, { from: owner });
      notAuthorized = authorized;
      authorized = null;

      const isAuthorized = await proxy.authorized.call(notAuthorized);
      assert(!isAuthorized);
    });
  });

  describe('getAuthorizedAddresses', () => {
    it('should return all authorized addresses', async () => {
      const initial = await proxy.getAuthorizedAddresses();
      assert.equal(initial.length, 1);
      await proxy.addAuthorizedAddress(notAuthorized, { from: owner });

      authorized = notAuthorized;
      notAuthorized = null;
      const afterAdd = await proxy.getAuthorizedAddresses();
      assert.equal(afterAdd.length, 2);
      assert(afterAdd.indexOf(authorized) !== -1);

      await proxy.removeAuthorizedAddress(authorized, { from: owner });
      notAuthorized = authorized;
      authorized = null;
      const afterRemove = await proxy.getAuthorizedAddresses();
      assert.equal(afterRemove.length, 1);
    });
  });
});
