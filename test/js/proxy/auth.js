const Proxy = artifacts.require('./db/Proxy.sol');
const assert = require('assert');

contract('Proxy', accounts => {
  const owner = accounts[0];
  const notOwner = accounts[1];

  let proxy;
  let authorized;
  let notAuthorized = owner;

  before(done => {
    Proxy.deployed().then(instance => {
      proxy = instance;
      done();
    });
  });

  describe('addAuthorizedAddress', () => {
    it('should throw if not called by owner', done => {
      proxy.addAuthorizedAddress(notOwner, { from: notOwner }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should allow owner to add an authorized address', done => {
      proxy.addAuthorizedAddress(notAuthorized, { from: owner }).then(() => {
        authorized = notAuthorized;
        notAuthorized = null;
        proxy.authorized.call(authorized).then(isAuthorized => {
          assert(isAuthorized);
          done();
        });
      });
    });
  });

  describe('removeAuthorizedAddress', () => {
    it('should throw if not called by owner', done => {
      proxy.removeAuthorizedAddress(authorized, { from: notOwner }).catch(e => {
        assert(e);
        done();
      });
    });
    it('should allow owner to remove an authorized address', done => {
      proxy.removeAuthorizedAddress(authorized, { from: owner }).then(() => {
        notAuthorized = authorized;
        authorized = null;
        proxy.authorized.call(notAuthorized).then(isAuthorized => {
          assert(!isAuthorized);
          done();
        });
      });
    });
  });

  describe('getAuthorizedAddresses', () => {
    it('should return all authorized addresses', done => {
      proxy.getAuthorizedAddresses().then(initial => {
        assert(initial.length === 1);
        proxy.addAuthorizedAddress(notAuthorized, { from: owner }).then(() => {
          authorized = notAuthorized;
          notAuthorized = null;
          proxy.getAuthorizedAddresses().then(afterAdd => {
            assert(afterAdd.length === 2);
            assert(afterAdd.indexOf(authorized !== -1));
            proxy.removeAuthorizedAddress(authorized, { from: owner }).then(() => {
              notAuthorized = authorized;
              authorized = null;
              proxy.getAuthorizedAddresses().then(afterRemove => {
                assert(afterRemove.length === 1);
                done();
              });
            });
          });
        });
      });
    });
  });
});
