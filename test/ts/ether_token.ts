import * as chai from 'chai';
import {chaiSetup} from './utils/chai_setup';
import Web3 = require('web3');
import {ZeroEx, ZeroExError} from '0x.js';
import * as BigNumber from 'bignumber.js';
import promisify = require('es6-promisify');
import { BNUtil } from '../../util/bn_util';
import { Artifacts } from '../../util/artifacts';
import { ContractInstance } from '../../util/types';
import { testUtil } from '../../util/test_util';

const { EtherToken } = new Artifacts(artifacts);

chaiSetup.configure();
const expect = chai.expect;
const { add, sub, mul, cmp } = BNUtil;

// In order to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
// with type `any` to a variable of type `Web3`.
const web3: Web3 = (global as any).web3;

contract('EtherToken', (accounts: string[]) => {
  const account = accounts[0];
  const gasPrice = new BigNumber(web3.toWei(20, 'gwei'));
  let zeroEx: ZeroEx;
  let etherTokenAddress: string;
  before(async () => {
    etherTokenAddress = EtherToken.address;
    zeroEx = new ZeroEx(web3.currentProvider, {
        gasPrice,
        etherTokenContractAddress: etherTokenAddress,
    });
  });

  const sendTransactionAsync = promisify(web3.eth.sendTransaction);
  const getTransactionReceiptAsync = promisify(web3.eth.getTransactionReceipt);
  const getEthBalanceAsync = async (owner: string) => {
    const balanceStr = await promisify(web3.eth.getBalance)(owner);
    const balance = new BigNumber(balanceStr);
    return balance;
  };

  describe('deposit', () => {
    it('should throw if caller attempts to deposit more Ether than caller balance', async () => {
      const initEthBalance = await getEthBalanceAsync(account);
      const ethToDeposit = initEthBalance.plus(1);

      return expect(zeroEx.etherToken.depositAsync(ethToDeposit, account))
        .to.be.rejectedWith(ZeroExError.InsufficientEthBalanceForDeposit);
    });

    it('should convert deposited Ether to wrapped Ether tokens', async () => {
      const initEthBalance = await getEthBalanceAsync(account);
      const initEthTokenBalance = await zeroEx.token.getBalanceAsync(etherTokenAddress, account);

      const ethToDeposit = new BigNumber(web3.toWei(1, 'ether'));

      const txHash = await zeroEx.etherToken.depositAsync(ethToDeposit, account);
      const receipt = await zeroEx.awaitTransactionMinedAsync(txHash);

      const ethSpentOnGas = mul(receipt.gasUsed, gasPrice);
      const finalEthBalance = await getEthBalanceAsync(account);
      const finalEthTokenBalance = await zeroEx.token.getBalanceAsync(etherTokenAddress, account);

      expect(finalEthBalance).to.be.bignumber.equal(sub(initEthBalance, add(ethToDeposit, ethSpentOnGas)));
      expect(finalEthTokenBalance).to.be.bignumber.equal(add(initEthTokenBalance, ethToDeposit));
    });
  });

  describe('withdraw', () => {
    it('should throw if caller attempts to withdraw greater than caller balance', async () => {
      const initEthTokenBalance = await zeroEx.token.getBalanceAsync(etherTokenAddress, account);
      const ethTokensToWithdraw = initEthTokenBalance.plus(1);

      return expect(zeroEx.etherToken.withdrawAsync(ethTokensToWithdraw, account))
        .to.be.rejectedWith(ZeroExError.InsufficientWEthBalanceForWithdrawal);
    });

    it('should convert ether tokens to ether with sufficient balance', async () => {
      const initEthTokenBalance = await zeroEx.token.getBalanceAsync(etherTokenAddress, account);
      const initEthBalance = await getEthBalanceAsync(account);
      const ethTokensToWithdraw = initEthTokenBalance;
      expect(ethTokensToWithdraw).to.not.be.bignumber.equal(0);
      const txHash = await zeroEx.etherToken.withdrawAsync(ethTokensToWithdraw, account);
      const receipt = await zeroEx.awaitTransactionMinedAsync(txHash);

      const ethSpentOnGas = mul(receipt.gasUsed, gasPrice);
      const finalEthBalance = await getEthBalanceAsync(account);
      const finalEthTokenBalance = await zeroEx.token.getBalanceAsync(etherTokenAddress, account);

      expect(finalEthBalance).to.be.bignumber.equal(add(initEthBalance, sub(ethTokensToWithdraw, ethSpentOnGas)));
      expect(finalEthTokenBalance).to.be.bignumber.equal(sub(initEthTokenBalance, ethTokensToWithdraw));
    });
  });

  describe('fallback', () => {
    it('should convert sent ether to ether tokens', async () => {
      const initEthBalance = await getEthBalanceAsync(account);
      const initEthTokenBalance = await zeroEx.token.getBalanceAsync(etherTokenAddress, account);

      const ethToDeposit = ZeroEx.toBaseUnitAmount(new BigNumber(1), 18);

      const txHash = await sendTransactionAsync({
        from: account,
        to: etherTokenAddress,
        value: ethToDeposit,
        gasPrice,
      });

      const receipt = await zeroEx.awaitTransactionMinedAsync(txHash);

      const ethSpentOnGas = mul(receipt.gasUsed, gasPrice);
      const finalEthBalance = await getEthBalanceAsync(account);
      const finalEthTokenBalance = await zeroEx.token.getBalanceAsync(etherTokenAddress, account);

      expect(finalEthBalance).to.be.bignumber.equal(sub(initEthBalance, add(ethToDeposit, ethSpentOnGas)));
      expect(finalEthTokenBalance).to.be.bignumber.equal(add(initEthTokenBalance, ethToDeposit));
    });
  });
});
