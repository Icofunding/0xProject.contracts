const Exchange = artifacts.require('./Exchange.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const BNutil = require('../../util/BNutil.js');

contract('Proxy', accounts => {
  const owner = accounts[0];
  const notOwner = accounts[1];

  const INIT_BAL = 100000000;
  const INIT_ALLOW = 100000000;

  let proxy;
  let dmyA;

  before(done => {
    Promise.all([
      Exchange.deployed(),
      Proxy.deployed(),
      DummyTokenA.deployed(),
    ]).then(instances => {
      [exchange, proxy, dmyA] = instances;
      Promise.all([
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: owner }),
        dmyA.setBalance(INIT_BAL, { from: owner }),
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: notOwner }),
        dmyA.setBalance(INIT_BAL, { from: notOwner }),
      ]).then(() => done());
    });
  });

  describe('isAuthorized', () => {
    it('should return true if authorized', done => {
      proxy.isAuthorized(Exchange.address).then(authorized => {
        assert(authorized);
        done();
      });
    });

    it('should return false if not authorized', done => {
      proxy.isAuthorized(owner).then(authorized => {
        assert(!authorized);
        done();
      });
    });
  });

  describe('setAuthorization', () => {
    it('should throw if not called by owner', done => {
      proxy.setAuthorization(notOwner, true).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should allow owner to set authorization', done => {
      proxy.setAuthorization(notOwner, true, { from: owner }).then(() => {
        proxy.isAuthorized(notOwner).then(authorized => {
          assert(authorized);
          proxy.setAuthorization(notOwner, false, { from: owner }).then(() => {
            proxy.isAuthorized(notOwner).then(innerAuthorized => {
              assert(!innerAuthorized);
              done();
            });
          });
        });
      }).catch(e => {
        assert(!e);
        done();
      });
    });

    it('should log 1 event', done => {
      proxy.setAuthorization(notOwner, false, { from: owner }).then(res => {
        assert(res.logs.length === 1);
        done();
      }).catch(e => {
        assert(!e);
        done();
      });
    });
  });

  describe('transferFrom', () => {
    it('should throw when called by an unauthorized address', done => {
      proxy.transferFrom(dmyA.address, owner, notOwner, 1000).then(res => {
        assert(!res);
        done();
      }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should allow an authorized address to transfer', done => {
      Promise.all([
        dmyA.balanceOf(owner),
        dmyA.balanceOf(notOwner),
      ]).then(bigNumberBalances => {
        balances = bigNumberBalances.map(balance => balance.toString());
        const [ownerBalance, notOwnerBalance] = balances;
        proxy.setAuthorization(owner, true, { from: owner }).then(() => {
          const transferAmt = 10000;
          proxy.transferFrom(dmyA.address, owner, notOwner, transferAmt, { from: owner }).then(() => {
            Promise.all([
              dmyA.balanceOf(owner),
              dmyA.balanceOf(notOwner),
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
