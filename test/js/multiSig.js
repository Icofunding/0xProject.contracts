const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
const MULTI_SIG_ABI = require('../../build/contracts/MultiSigWallet.json').abi;
const util = require('../../util/index.js')(web3);
const assert = require('assert');

contract('MultiSigWallet', accounts => {
  const owners = [accounts[0], accounts[1]];
  const SECONDS_REQUIRED = 10000;

  let multiSig;
  let multiSigUtil;
  let txId;
  let initialThreshold;

  before(done => {
    MultiSigWallet.deployed().then(instance => {
      multiSig = instance;
      multiSigUtil = util.multiSigUtil(instance);
      multiSig.secondsRequired.call().then(threshold => {
        initialThreshold = threshold.toNumber();
        done();
      });
    });
  });

  describe('changeRequiredSeconds', () => {
    it('should throw when not called by wallet', done => {
      multiSig.changeRequiredSeconds(SECONDS_REQUIRED, { from: owners[0] }).catch(e => {
        assert(e);
        done();
      });
    });

    it('should not execute without enough confirmations', done => {
      multiSigUtil.submitTransaction({
        destination: MultiSigWallet.address,
        from: owners[0],
        dataParams: {
          name: 'changeRequiredSeconds',
          abi: MULTI_SIG_ABI,
          args: [SECONDS_REQUIRED],
        },
      }).then(subRes => {
        txId = subRes.logs[0].args.transactionId.toString();
        multiSig.executeTransaction(txId).then(execRes => {
          assert(execRes.logs.length === 0);
          multiSig.transactions.call(txId).then(tx => {
            const executed = tx[4];
            assert(!executed);
            done();
          });
        });
      });
    });

    it('should set confirmation time with enough confirmations', done => {
      multiSig.confirmTransaction(txId, { from: owners[1] }).then(res => {
        assert(res.logs.length === 2);
        web3.eth.getBlockNumber((err1, blockNum) => {
          web3.eth.getBlock(blockNum, (err2, blockInfo) => {
            const timestamp = blockInfo.timestamp.toString();
            multiSig.transactions(txId).then(tx => {
              const confirmationTime = tx[2].toString();
              assert(timestamp === confirmationTime);
              done();
            });
          });
        });
      });
    });

    it('should be executable with enough confirmations and secondsRequired of 0', done => {
      assert(initialThreshold === 0);
      multiSig.executeTransaction(txId).then(res => {
        assert(res.logs.length === 2);
        multiSig.secondsRequired.call().then(threshold => {
          const newThreshold = threshold.toNumber();
          assert(newThreshold === SECONDS_REQUIRED);
          done();
        });
      });
    });

    const newThreshold = 0;
    it('should not execute if it has enough confirmations but is not past the activation threshold', done => {
      multiSigUtil.submitTransaction({
        destination: MultiSigWallet.address,
        from: owners[0],
        dataParams: {
          name: 'changeRequiredSeconds',
          abi: MULTI_SIG_ABI,
          args: [newThreshold],
        },
      }).then(subRes => {
        txId = subRes.logs[0].args.transactionId.toString();
        multiSig.confirmTransaction(txId, { from: owners[1] }).then(confRes => {
          assert(confRes.logs.length === 2);
          multiSig.executeTransaction(txId).then(execRes => {
            assert(execRes.logs.length === 0);
            multiSig.transactions.call(txId).then(tx => {
              const executed = tx[4];
              assert(!executed);
              done();
            });
          });
        });
      });
    });

    it('should execute if it has enough confirmations and is past the activation threshold', done => {
      util.rpc.increaseTime(SECONDS_REQUIRED).then(() => {
        multiSig.executeTransaction(txId).then(() => {
          multiSig.secondsRequired.call().then(threshold => {
            assert(threshold.toNumber() === newThreshold);
            done();
          });
        });
      }).catch(e => {
        assert(!e);
        done();
      });
    });
  });
});
