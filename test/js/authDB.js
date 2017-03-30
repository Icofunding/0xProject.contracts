const AuthDB = artifacts.require('./db/AuthDB.sol');
const assert = require('assert');

contract('AuthDB', accounts => {
  const owner = accounts[0];
  const notOwner = accounts[1];

  let authDB;
  let authorized;
  let notAuthorized = owner;

  before(done => {
    AuthDB.deployed().then(instance => {
      authDB = instance;
      done();
    });
  });

  describe('isAddressAuthorized', () => {
    it('should return false if address is not authorized', done => {
      authDB.isAddressAuthorized(owner).then(isAuthorized => {
        assert(!isAuthorized);
        done();
      });
    });
  });

  describe('addAuthorizedAddress', () => {
    it('should throw if not called by owner', done => {
      authDB.addAuthorizedAddress(notOwner, { from: notOwner }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should allow owner to add an authorized address', done => {
      authDB.addAuthorizedAddress(notAuthorized, { from: owner }).then(() => {
        authorized = notAuthorized;
        notAuthorized = null;
        authDB.isAddressAuthorized(authorized).then(isAuthorized => {
          assert(isAuthorized);
          done();
        });
      });
    });
  });

  describe('removeAuthorizedAddress', () => {
    it('should throw if not called by owner', done => {
      authDB.removeAuthorizedAddress(authorized, { from: notOwner }).catch(e => {
        assert(e);
        done();
      });
    });
    it('should allow owner to remove an authorized address', done => {
      authDB.removeAuthorizedAddress(authorized, { from: owner }).then(() => {
        notAuthorized = authorized;
        authorized = null;
        authDB.isAddressAuthorized(notAuthorized).then(isAuthorized => {
          assert(!isAuthorized);
          done();
        });
      });
    });
  });

  describe('getAuthorizedAddresses', () => {
    it('should return all authorized addresses', done => {
      authDB.getAuthorizedAddresses().then(initial => {
        assert(initial.length === 0);
        authDB.addAuthorizedAddress(notAuthorized, { from: owner }).then(() => {
          authorized = notAuthorized;
          notAuthorized = null;
          authDB.getAuthorizedAddresses().then(afterAdd => {
            assert(afterAdd.length === 1);
            assert(afterAdd.indexOf(authorized !== -1));
            authDB.removeAuthorizedAddress(authorized, { from: owner }).then(() => {
              notAuthorized = authorized;
              authorized = null;
              authDB.getAuthorizedAddresses().then(afterRemove => {
                assert(afterRemove.length === 0);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('addAuthorizedAddresses', () => {
    it('should throw if not called by owner', done => {
      authDB.addAuthorizedAddresses([notOwner, notAuthorized], { from: notOwner }).catch(e => {
        assert(e);
        done();
      });
    });
  });

  describe('removeAuthorizedAddresses', () => {
    it('should throw if not called by owner', done => {
      authDB.removeAuthorizedAddresses([notOwner, notAuthorized], { from: notOwner }).catch(e => {
        assert(e);
        done();
      });
    });
  });
});
