import * as chai from 'chai';
import {chaiSetup} from './utils/chai_setup';
import * as Web3 from 'web3';
import {ZeroEx} from '0x.js';
import * as BigNumber from 'bignumber.js';
import { testUtil } from '../../util/test_util';
import { Artifacts } from '../../util/artifacts';
import { ContractInstance } from '../../util/types';

const { DummyToken } = new Artifacts(artifacts);
const web3: Web3 = (global as any).web3;
chaiSetup.configure();
const expect = chai.expect;

contract('UnlimitedAllowanceToken', (accounts: string[]) => {
  const zeroEx = new ZeroEx(web3.currentProvider);
  const owner = accounts[0];
  const spender = accounts[1];

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
      expect(finalOwnerBalance).to.be.bignumber.equal(expectedFinalOwnerBalance);
      expect(finalReceiverBalance).to.be.bignumber.equal(expectedFinalReceiverBalance);
    });

    it('should return true on a 0 value transfer', async () => {
      const didReturnTrue = await token.transfer.call(spender, 0, { from: owner });
      expect(didReturnTrue).to.be.true();
    });
  });

  describe('transferFrom', () => {
    it('should return false if owner has insufficient balance', async () => {
      const ownerBalance = await token.balanceOf(owner);
      const amountToTransfer = ownerBalance.plus(1);
      await token.approve(spender, amountToTransfer, { from: owner });
      const didReturnTrue = await token.transferFrom.call(owner, spender, amountToTransfer, { from: spender });
      expect(didReturnTrue).to.be.false();
    });

    it('should return false if spender has insufficient allowance', async () => {
      const ownerBalance = await token.balanceOf(owner);
      const amountToTransfer = ownerBalance;

      const spenderAllowance = await token.allowance(owner, spender);
      const spenderAllowanceIsInsufficient = spenderAllowance.cmp(amountToTransfer) < 0;
      expect(spenderAllowanceIsInsufficient).to.be.true();

      const didReturnTrue = await token.transferFrom.call(owner, spender, amountToTransfer, { from: spender });
      expect(didReturnTrue).to.be.false();
    });

    it('should return true on a 0 value transfer', async () => {
      const amountToTransfer = 0;
      const didReturnTrue = await token.transferFrom.call(owner, spender, amountToTransfer, { from: spender });
      expect(didReturnTrue).to.be.true();
    });

    it('should not modify spender allowance if spender allowance is 2^256 - 1', async () => {
      const initOwnerBalance = await token.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      const initSpenderAllowance = zeroEx.token.UNLIMITED_ALLOWANCE_IN_BASE_UNITS;
      await token.approve(spender, initSpenderAllowance, { from: owner });
      await token.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newSpenderAllowance = await token.allowance(owner, spender);
      expect(initSpenderAllowance).to.be.bignumber.equal(newSpenderAllowance);
    });

    it('should transfer the correct balances if spender has sufficient allowance', async () => {
      const initOwnerBalance = await token.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      const initSpenderAllowance = initOwnerBalance;
      await token.approve(spender, initSpenderAllowance, { from: owner });
      await token.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newOwnerBalance = await token.balanceOf(owner);
      const newSpenderBalance = await token.balanceOf(spender);

      expect(newOwnerBalance).to.be.bignumber.equal(0);
      expect(newSpenderBalance).to.be.bignumber.equal(initOwnerBalance);
    });

    it('should modify allowance if spender has sufficient allowance less than 2^256 - 1', async () => {
      const initOwnerBalance = await token.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      const initSpenderAllowance = initOwnerBalance;
      await token.approve(spender, initSpenderAllowance, { from: owner });
      await token.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newSpenderAllowance = await token.allowance(owner, spender);
      expect(newSpenderAllowance).to.be.bignumber.equal(0);
    });
  });
});
