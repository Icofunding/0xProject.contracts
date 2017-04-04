const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const util = require('../../../util/index.js')(web3);

const { add, sub } = util.BNutil;

contract('Proxy', accounts => {
  const INIT_BAL = 100000000;
  const INIT_ALLOW = 100000000;

  const owner = accounts[0];
  const notAuthorized = owner;

  let proxy;
  let dmyA;

  let getDmyBalances;

  before(done => {
    Promise.all([
      Proxy.deployed(),
      DummyTokenA.deployed(),
    ]).then(instances => {
      [proxy, dmyA] = instances;
      getDmyBalances = util.getBalancesFactory([dmyA], [accounts[0], accounts[1]]);
      Promise.all([
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: accounts[0] }),
        dmyA.setBalance(INIT_BAL, { from: accounts[0] }),
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: accounts[1] }),
        dmyA.setBalance(INIT_BAL, { from: accounts[1] }),
      ]).then(() => done());
    });
  });

  describe('transferFrom', () => {
    it('should throw when called by an unauthorized address', done => {
      proxy.transferFrom(dmyA.address, accounts[0], accounts[1], 1000, { from: notAuthorized }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should allow an authorized address to transfer', done => {
      getDmyBalances().then(balances => {
        proxy.addAuthorizedAddress(notAuthorized, { from: owner }).then(() => {
          const transferAmt = 10000;
          proxy.transferFrom(dmyA.address, accounts[0], accounts[1], transferAmt, { from: notAuthorized }).then(() => {
            getDmyBalances().then(newBalances => {
              assert(newBalances[accounts[0]][dmyA.address] === sub(balances[accounts[0]][dmyA.address], transferAmt));
              assert(newBalances[accounts[1]][dmyA.address] === add(balances[accounts[1]][dmyA.address], transferAmt));
              done();
            });
          });
        });
      });
    });
  });
});
