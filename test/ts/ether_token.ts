import * as assert from 'assert';
import Web3 = require('web3');
import * as BigNumber from 'bignumber.js';
import promisify = require('es6-promisify');
import { BNUtil } from '../../util/bn_util';
import { Artifacts } from '../../util/artifacts';
import { ContractInstance } from '../../util/types';
import { testUtil } from '../../util/test_util';

const { EtherToken } = new Artifacts(artifacts);

const { add, sub, mul, cmp } = BNUtil;

// In order to benefit from type-safety, we re-assign the global web3 instance injected by Truffle
// with type `any` to a variable of type `Web3`.
const web3Instance: Web3 = web3;

contract('EtherToken', (accounts: string[]) => {
  const account = accounts[0];
  const gasPrice = new BigNumber(web3Instance.toWei(20, 'gwei'));

  const sendTransactionAsync = promisify(web3Instance.eth.sendTransaction);
  const getTransactionReceiptAsync = promisify(web3Instance.eth.getTransactionReceipt);
  const getEthBalanceAsync = async (owner: string) => {
    const balanceStr = await promisify(web3Instance.eth.getBalance)(owner);
    const balance = new BigNumber(balanceStr);
    return balance;
  };
  let ethToken: ContractInstance;

  before(async () => {
    ethToken = await EtherToken.new();
  });

  describe('deposit', () => {
    it('should throw if caller attempts to deposit more Ether than caller balance', async () => {
      const initEthBalance = await getEthBalanceAsync(account);
      const ethToDeposit = add(initEthBalance, 1);

      try {
        await ethToken.deposit({
          from: account,
          value: ethToDeposit,
          gasPrice,
        });
        throw new Error('deposit succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should convert deposited Ether to wrapped Ether tokens', async () => {
      const initEthBalance = await getEthBalanceAsync(account);
      const initEthTokenBalance = await ethToken.balanceOf(account);

      const ethToDeposit = new BigNumber(web3Instance.toWei(1, 'ether'));

      const res = await ethToken.deposit({
        from: account,
        value: ethToDeposit,
        gasPrice,
      });

      const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);
      const finalEthBalance = await getEthBalanceAsync(account);
      const finalEthTokenBalance = await ethToken.balanceOf(account);

      assert.equal(finalEthBalance, sub(initEthBalance, add(ethToDeposit, ethSpentOnGas)));
      assert.equal(finalEthTokenBalance.toString(), add(initEthTokenBalance, ethToDeposit));
    });
  });

  describe('withdraw', () => {
    it('should throw if caller attempts to withdraw greater than caller balance', async () => {
      const initEthTokenBalance = await ethToken.balanceOf(account);
      const ethTokensToWithdraw = add(initEthTokenBalance, 1);
      try {
        await ethToken.withdraw(ethTokensToWithdraw, { from: account });
        throw new Error('withdraw succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should convert ether tokens to ether with sufficient balance', async () => {
      const initEthTokenBalance = await ethToken.balanceOf(account);
      const initEthBalance = await getEthBalanceAsync(account);
      const ethTokensToWithdraw = initEthTokenBalance;
      assert.equal(!ethTokensToWithdraw.toNumber(), 0);

      const res = await ethToken.withdraw(ethTokensToWithdraw, { from: account, gasPrice });

      const ethSpentOnGas = mul(res.receipt.gasUsed, gasPrice);
      const finalEthBalance = await getEthBalanceAsync(account);
      const finalEthTokenBalance = await ethToken.balanceOf(account);

      assert.equal(finalEthBalance, add(initEthBalance, sub(ethTokensToWithdraw, ethSpentOnGas)));
      assert.equal(finalEthTokenBalance.toString(), sub(initEthTokenBalance, ethTokensToWithdraw));
    });
  });

  describe('fallback', () => {
    it('should convert sent ether to ether tokens', async () => {
      const initEthBalance = await getEthBalanceAsync(account);
      const initEthTokenBalance = await ethToken.balanceOf(account);

      const ethToDeposit = new BigNumber(web3Instance.toWei(1, 'ether'));

      const txHash = await sendTransactionAsync({
        from: account,
        to: ethToken.address,
        value: ethToDeposit,
        gasPrice,
      });

      const receipt = await getTransactionReceiptAsync(txHash);

      const ethSpentOnGas = mul(receipt.gasUsed, gasPrice);
      const finalEthBalance = await getEthBalanceAsync(account);
      const finalEthTokenBalance = await ethToken.balanceOf(account);

      assert.equal(finalEthBalance, sub(initEthBalance, add(ethToDeposit, ethSpentOnGas)));
      assert.equal(finalEthTokenBalance.toString(), add(initEthTokenBalance, ethToDeposit));
    });
  });
});
