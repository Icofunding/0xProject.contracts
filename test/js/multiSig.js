require('babel-polyfill');
require('source-map-support/register');
const assert = require('assert');
const promisify = require('es6-promisify');
const MULTI_SIG_ABI = require('../../build/contracts/MultiSigWallet.json').abi;
const MultiSigWrapper = require('../../util/multiSigWrapper');
const testUtil = require('../../util/testUtil');
const RPC = require('../../util/rpc');

const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');

contract('MultiSigWallet', accounts => {
  const owners = [accounts[0], accounts[1]];
  const SECONDS_REQUIRED = 10000;

  let multiSig;
  let multiSigWrapper;
  let txId;
  let initialThreshold;
  let rpc;

  before(async () => {
    multiSig = await MultiSigWallet.deployed();
    multiSigWrapper = new MultiSigWrapper(multiSig);

    const threshold = await multiSig.secondsRequired.call();
    initialThreshold = threshold.toNumber();
    rpc = new RPC();
  });

  describe('changeRequiredSeconds', () => {
    it('should throw when not called by wallet', async () => {
      try {
        await multiSig.changeRequiredSeconds(SECONDS_REQUIRED, { from: owners[0] });
        throw new Error('changeRequiredSeconds succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should not execute without enough confirmations', async () => {
      const subRes = await multiSigWrapper.submitTransactionAsync({
        destination: MultiSigWallet.address,
        from: owners[0],
        dataParams: {
          name: 'changeRequiredSeconds',
          abi: MULTI_SIG_ABI,
          args: [SECONDS_REQUIRED],
        },
      });

      txId = subRes.logs[0].args.transactionId.toString();
      const execRes = await multiSig.executeTransaction(txId);
      assert.equal(execRes.logs.length, 0);

      const tx = await multiSig.transactions.call(txId);
      const executed = tx[4];
      assert(!executed);
    });

    it('should set confirmation time with enough confirmations', async () => {
      const res = await multiSig.confirmTransaction(txId, { from: owners[1] });
      assert.equal(res.logs.length, 2);
      const blockNum = await promisify(web3.eth.getBlockNumber)();
      const blockInfo = await promisify(web3.eth.getBlock)(blockNum);
      const timestamp = blockInfo.timestamp.toString();
      const tx = await multiSig.transactions(txId);

      const confirmationTime = tx[2].toString();
      assert.equal(timestamp, confirmationTime);
    });

    it('should be executable with enough confirmations and secondsRequired of 0', async () => {
      assert.equal(initialThreshold, 0);

      const res = await multiSig.executeTransaction(txId);
      assert.equal(res.logs.length, 2);

      const threshold = await multiSig.secondsRequired.call();
      const newThreshold = threshold.toNumber();
      assert.equal(newThreshold, SECONDS_REQUIRED);
    });

    const newThreshold = 0;
    it('should not execute if it has enough confirmations but is not past the activation threshold', async () => {
      const subRes = await multiSigWrapper.submitTransactionAsync({
        destination: MultiSigWallet.address,
        from: owners[0],
        dataParams: {
          name: 'changeRequiredSeconds',
          abi: MULTI_SIG_ABI,
          args: [newThreshold],
        },
      });

      txId = subRes.logs[0].args.transactionId.toString();
      const confRes = await multiSig.confirmTransaction(txId, { from: owners[1] });
      assert.equal(confRes.logs.length, 2);

      const execRes = await multiSig.executeTransaction(txId);
      assert.equal(execRes.logs.length, 0);

      const tx = await multiSig.transactions.call(txId);
      const executed = tx[4];
      assert(!executed);
    });

    it('should execute if it has enough confirmations and is past the activation threshold', async () => {
      await rpc.increaseTimeAsync(SECONDS_REQUIRED);
      await multiSig.executeTransaction(txId);

      const threshold = await multiSig.secondsRequired.call();
      assert.equal(threshold.toNumber(), newThreshold);
    });
  });
});
