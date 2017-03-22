const Exchange = artifacts.require('./Exchange.sol');
const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const util = require('../../util/index.js')(web3);
const PROXY_ABI = require('../../build/contracts/Proxy.json').abi;
const { add, sub } = require('../../util/BNutil.js');

contract('Proxy', accounts => {
  const INIT_BAL = 100000000;
  const INIT_ALLOW = 100000000;

  let multiSig;
  let proxy;
  let dmyA;

  let multiSigUtil;
  let getDmyBalances;

  before(done => {
    Promise.all([
      MultiSigWallet.deployed(),
      Proxy.deployed(),
      DummyTokenA.deployed(),
    ]).then(instances => {
      [multiSig, proxy, dmyA] = instances;
      multiSigUtil = util.multiSigUtil(multiSig);
      getDmyBalances = util.getBalancesFactory([dmyA], [accounts[0], accounts[1]]);
      Promise.all([
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: accounts[0] }),
        dmyA.setBalance(INIT_BAL, { from: accounts[0] }),
        dmyA.approve(Proxy.address, INIT_ALLOW, { from: accounts[1] }),
        dmyA.setBalance(INIT_BAL, { from: accounts[1] }),
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
      proxy.isAuthorized(accounts[0]).then(authorized => {
        assert(!authorized);
        done();
      });
    });
  });

  describe('isOptedOut', () => {
    it('should default to false', done => {
      proxy.isOptedOut(Exchange.address, accounts[0]).then(optedOut => {
        assert(!optedOut);
        done();
      });
    });
  });

  describe('setAuthorization', () => {
    it('should throw if not called by owner', done => {
      proxy.setAuthorization(accounts[0], true).catch(e => {
        assert(e);
        done();
      });
    });

    it('should allow owner to set authorization', done => {
      multiSigUtil.submitTransaction({
        destination: Proxy.address,
        from: accounts[0],
        dataParams: {
          name: 'setAuthorization',
          abi: PROXY_ABI,
          args: [accounts[0], true],
        },
      }).then(res1 => {
        let transactionId = res1.logs[1].args.transactionId.toString();
        multiSigUtil.confirmTransaction({ transactionId, from: accounts[1] }).then(() => {
          proxy.isAuthorized(accounts[0]).then(authorized => {
            assert(authorized);
            multiSigUtil.submitTransaction({
              destination: Proxy.address,
              from: accounts[0],
              dataParams: {
                name: 'setAuthorization',
                abi: PROXY_ABI,
                args: [accounts[0], false],
              },
            }).then(res2 => {
              transactionId = res2.logs[1].args.transactionId.toString();
              multiSigUtil.confirmTransaction({ transactionId, from: accounts[1] }).then(() => {
                proxy.isAuthorized(accounts[0]).then(newAuth => {
                  assert(!newAuth);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('setPersonalAuthorization', () => {
    it('should allow any account to opt out', done => {
      proxy.setPersonalAuthorization(Exchange.address, true, { from: accounts[0] }).then(() => {
        proxy.isOptedOut(Exchange.address, accounts[0]).then(optedOut => {
          assert(optedOut);
          done();
        });
      });
    });

    it('should allow any account to opt back in', done => {
      proxy.setPersonalAuthorization(Exchange.address, false, { from: accounts[0] }).then(() => {
        proxy.isOptedOut(Exchange.address, accounts[0]).then(optedOut => {
          assert(!optedOut);
          done();
        });
      });
    });
  });

  describe('transferFrom', () => {
    it('should throw when called by an unauthorized address', done => {
      proxy.transferFrom(dmyA.address, accounts[0], accounts[1], 1000, { from: accounts[0] }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should throw when the transfer from account is opted out', done => {
      proxy.setPersonalAuthorization(Exchange.address, true, { from: accounts[0] }).then(() => {
        proxy.transferFrom(dmyA.address, accounts[0], accounts[1], 1000, { from: accounts[0] }).catch(e => {
          assert(e);
          proxy.setPersonalAuthorization(Exchange.address, false, { from: accounts[0] }).then(() => {
            done();
          });
        });
      });
    });

    it('should allow an authorized address to transfer', done => {
      getDmyBalances().then(balances => {
        multiSigUtil.submitTransaction({
          destination: Proxy.address,
          from: accounts[0],
          dataParams: {
            name: 'setAuthorization',
            abi: PROXY_ABI,
            args: [accounts[0], true],
          },
        }).then(res => {
          const transactionId = res.logs[1].args.transactionId.toString();
          multiSigUtil.confirmTransaction({ transactionId, from: accounts[1] }).then(() => {
            const transferAmt = 10000;
            proxy.transferFrom(dmyA.address, accounts[0], accounts[1], transferAmt, { from: accounts[0] }).then(() => {
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
});
