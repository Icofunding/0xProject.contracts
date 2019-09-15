import * as chai from 'chai';
import * as BigNumber from 'bignumber.js';
import {chaiSetup} from './utils/chai_setup';
import promisify = require('es6-promisify');
import Web3 = require('web3');
import {RPC} from '../../util/rpc';
import {MultiSigWrapper} from '../../util/multi_sig_wrapper';
import {constants} from '../../util/constants';
import {ContractInstance} from '../../util/types';
import * as multiSigWalletJSON from '../../build/contracts/MultiSigWalletWithTimeLock.json';
import {Artifacts} from '../../util/artifacts';

const {MultiSigWalletWithTimeLock} = new Artifacts(artifacts);

const MULTI_SIG_ABI = (multiSigWalletJSON as any).abi;
chaiSetup.configure();
const expect = chai.expect;

// In order to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
// with type `any` to a variable of type `Web3`.
const web3: Web3 = (global as any).web3;

contract('MultiSigWalletWithTimeLock', (accounts: string[]) => {
  const owners = [accounts[0], accounts[1]];
  const SECONDS_TIME_LOCKED = 10000;

  let multiSig: ContractInstance;
  let multiSigWrapper: MultiSigWrapper;
  let txId: number;
  let initialSecondsTimeLocked: number;
  let rpc: RPC;

  before(async () => {
    multiSig = await MultiSigWalletWithTimeLock.deployed();
    multiSigWrapper = new MultiSigWrapper(multiSig);

    const secondsTimeLocked = await multiSig.secondsTimeLocked.call();
    initialSecondsTimeLocked = secondsTimeLocked.toNumber();
    rpc = new RPC();
  });

  describe('changeTimeLock', () => {
    it('should throw when not called by wallet', async () => {
      return expect(multiSig.changeTimeLock(SECONDS_TIME_LOCKED, {from: owners[0]}))
        .to.be.rejectedWith(constants.INVALID_OPCODE);
    });

    it('should throw without enough confirmations', async () => {
      const destination = multiSig.address;
      const from = owners[0];
      const dataParams = {
        name: 'changeTimeLock',
        abi: MULTI_SIG_ABI,
        args: [SECONDS_TIME_LOCKED],
      };
      const subRes = await multiSigWrapper.submitTransactionAsync(destination, from, dataParams);

      txId = subRes.logs[0].args.transactionId.toNumber();
      return expect(multiSig.executeTransaction(txId)).to.be.rejectedWith(constants.INVALID_OPCODE);
    });

    it('should set confirmation time with enough confirmations', async () => {
      const res = await multiSig.confirmTransaction(txId, {from: owners[1]});
      expect(res.logs).to.have.length(2);
      const blockNum = await promisify(web3.eth.getBlockNumber)();
      const blockInfo = await promisify(web3.eth.getBlock)(blockNum);
      const timestamp = new BigNumber(blockInfo.timestamp);
      const confirmationTimeBigNum = new BigNumber(await multiSig.confirmationTimes.call(txId));

      expect(timestamp).to.be.bignumber.equal(confirmationTimeBigNum);
    });

    it('should be executable with enough confirmations and secondsTimeLocked of 0', async () => {
      expect(initialSecondsTimeLocked).to.be.equal(0);

      const res = await multiSig.executeTransaction(txId);
      expect(res.logs).to.have.length(2);

      const secondsTimeLocked = new BigNumber(await multiSig.secondsTimeLocked.call());
      expect(secondsTimeLocked).to.be.bignumber.equal(SECONDS_TIME_LOCKED);
    });

    const newSecondsTimeLocked = 0;
    it('should throw if it has enough confirmations but is not past the time lock', async () => {
      const destination = multiSig.address;
      const from = owners[0];
      const dataParams = {
        name: 'changeTimeLock',
        abi: MULTI_SIG_ABI,
        args: [newSecondsTimeLocked],
      };
      const subRes = await multiSigWrapper.submitTransactionAsync(destination, from, dataParams);

      txId = subRes.logs[0].args.transactionId.toNumber();
      const confRes = await multiSig.confirmTransaction(txId, {from: owners[1]});
      expect(confRes.logs).to.have.length(2);

      return expect(multiSig.executeTransaction(txId)).to.be.rejectedWith(constants.INVALID_OPCODE);
    });

    it('should execute if it has enough confirmations and is past the time lock', async () => {
      await rpc.increaseTimeAsync(SECONDS_TIME_LOCKED);
      await multiSig.executeTransaction(txId);

      const secondsTimeLocked = new BigNumber(await multiSig.secondsTimeLocked.call());
      expect(secondsTimeLocked).to.be.bignumber.equal(newSecondsTimeLocked);
    });
  });
});
