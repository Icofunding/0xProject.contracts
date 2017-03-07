const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const BNutil = require('../../util/BNutil.js');

contract('Proxy', function(accounts) {
  const owner = accounts[0];
  const notOwner = accounts[1];

  const INIT_BAL = 100000000;
  const INIT_ALLOW = 100000000;

  let exchange;
  let proxy;
  let dmyA;

  before(function(done) {
    Promise.all([
      Exchange.deployed(),
      Proxy.deployed(),
      DummyTokenA.deployed()
    ]).then(instances => {
      [exchange, proxy, dmyA] = instances;
      Promise.all([
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: owner }),
        dmyA.setBalance(INIT_BAL, { from: owner }),
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: notOwner }),
        dmyA.setBalance(INIT_BAL, { from: notOwner })
      ]).then(() => done());
    });
  });

  describe('isAuthorized', function() {
    it('should return true if authorized', function(done) {
      proxy.isAuthorized(Exchange.address).then(authorized => {
        assert(authorized);
        done();
      });
    });

    it('should return false if not authorized', function(done) {
      proxy.isAuthorized(owner).then(authorized => {
        assert(!authorized);
        done();
      });
    });
  });

  describe('setAuthorization', function() {
    it('should throw if not called by owner', function(done) {
      proxy.setAuthorization(notOwner, true).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should allow owner to set authorization', function(done) {
      proxy.setAuthorization(notOwner, true, { from: owner }).then(res => {
        proxy.isAuthorized(notOwner).then(authorized => {
          assert(authorized);
          proxy.setAuthorization(notOwner, false, { from: owner }).then(res => {
            proxy.isAuthorized(notOwner).then(authorized => {
              assert(!authorized);
              done();
            });
          });
        });
      }).catch(e => {
        assert(!e);
        done();
      });
    });
  });

  describe('transferFrom', function() {
    it('should throw when called by an unauthorized address', function(done) {
      proxy.transferFrom(dmyA.address, owner, notOwner, 1000).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should allow an authorized address to transfer', function(done) {
      Promise.all([
        dmyA.balanceOf(owner),
        dmyA.balanceOf(notOwner)
      ]).then(balances => {
        balances = balances.map(balance => balance.toString());
        let [ownerBalance, notOwnerBalance] = balances;
        proxy.setAuthorization(owner, true, { from: owner }).then(res => {
          let transferAmt = 10000;
          proxy.transferFrom(dmyA.address, owner, notOwner, transferAmt, { from: owner}).then(res => {
            Promise.all([
              dmyA.balanceOf(owner),
              dmyA.balanceOf(notOwner)
            ]).then(newBalances => {
              assert(BNutil.sub(ownerBalance, transferAmt) === newBalances[0].toString());
              assert(BNutil.add(notOwnerBalance, transferAmt) === newBalances[1].toString());
              done();
            });
          }).catch(e => {
            assert(!e);
            done();
          });
        });
      });
    });
  });
});
