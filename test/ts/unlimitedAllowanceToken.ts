import * as assert from 'assert';
import * as Web3 from 'web3';
import * as BigNumber from 'bignumber.js';
import { testUtil } from '../../util/test_util';
import { Artifacts } from '../../util/artifacts';
import { ContractInstance } from '../../util/types';

const { DummyToken } = new Artifacts(artifacts);
const web3Instance: Web3 = web3;

contract('UnlimitedAllowanceToken', (accounts: string[]) => {
  const owner = accounts[0];
  const spender = accounts[1];

  const MAX_UINT = (new BigNumber(2)).pow(256).minus(1);
  const MAX_MINT_VALUE = new BigNumber(100000000000000000000);

  let token: ContractInstance;

  beforeEach(async () => {
    token = await DummyToken.new({ from: owner });
    await token.mint(MAX_MINT_VALUE, { from: owner });
  });

  describe('transfer', () => {
    it('should transfer balance from sender to receiver', async () => {
      const receiver = spender;
      const initOwnerBalance = await token.balanceOf(owner);
      const amountToTransfer = new BigNumber(1);
      await token.transfer(receiver, amountToTransfer, { from: owner });
      const finalOwnerBalance = await token.balanceOf(owner);
      const finalReceiverBalance = await token.balanceOf(receiver);

      const expectedFinalOwnerBalance = initOwnerBalance.minus(amountToTransfer);
      const expectedFinalReceiverBalance = amountToTransfer;
      assert.equal(finalOwnerBalance.toString(), expectedFinalOwnerBalance.toString());
      assert.equal(finalReceiverBalance.toString(), expectedFinalReceiverBalance.toString());
    });

    it('should return true on a 0 value transfer', async () => {
      const didReturnTrue = await token.transfer.call(spender, 0, { from: owner });
      assert.equal(didReturnTrue, true);
    });
  });

  describe('transferFrom', () => {
    it('should return false if owner has insufficient balance', async () => {
      const ownerBalance = await token.balanceOf(owner);
      const amountToTransfer = ownerBalance.plus(1);
      await token.approve(spender, amountToTransfer, { from: owner });
      const didReturnTrue = await token.transferFrom.call(owner, spender, amountToTransfer, { from: spender });
      assert.equal(didReturnTrue, false);
    });

    it('should return false if spender has insufficient allowance', async () => {
      const ownerBalance = await token.balanceOf(owner);
      const amountToTransfer = ownerBalance;

      const spenderAllowance = await token.allowance(owner, spender);
      const spenderAllowanceIsInsufficient = spenderAllowance.cmp(amountToTransfer) < 0;
      assert.equal(spenderAllowanceIsInsufficient, true);

      const didReturnTrue = await token.transferFrom.call(owner, spender, amountToTransfer, { from: spender });
      assert.equal(didReturnTrue, false);
    });

    it('should return true on a 0 value transfer', async () => {
      const amountToTransfer = 0;
      const didReturnTrue = await token.transferFrom.call(owner, spender, amountToTransfer, { from: spender });
      assert.equal(didReturnTrue, true);
    });

    it('should not modify spender allowance if spender allowance is 2^256 - 1', async () => {
      const initOwnerBalance = await token.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      const initSpenderAllowance = MAX_UINT;
      await token.approve(spender, initSpenderAllowance, { from: owner });
      await token.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newSpenderAllowance = await token.allowance(owner, spender);
      assert.equal(initSpenderAllowance.toFixed(), newSpenderAllowance.toFixed());
    });

    it('should transfer the correct balances if spender has sufficient allowance', async () => {
      const initOwnerBalance = await token.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      const initSpenderAllowance = initOwnerBalance;
      await token.approve(spender, initSpenderAllowance, { from: owner });
      await token.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newOwnerBalance = await token.balanceOf(owner);
      const newSpenderBalance = await token.balanceOf(spender);

      assert.equal(newOwnerBalance.toString(), '0');
      assert.equal(newSpenderBalance.toString(), initOwnerBalance.toString());
    });

    it('should modify allowance if spender has sufficient allowance less than 2^256 - 1', async () => {
      const initOwnerBalance = await token.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      const initSpenderAllowance = initOwnerBalance;
      await token.approve(spender, initSpenderAllowance, { from: owner });
      await token.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newSpenderAllowance = await token.allowance(owner, spender);
      assert.equal(newSpenderAllowance, '0');
    });
  });
});
