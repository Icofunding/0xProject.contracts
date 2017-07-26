import * as assert from 'assert';
import * as Web3 from 'web3';
import * as BigNumber from 'bignumber.js';
import { testUtil } from '../../util/test_util';
import { Artifacts } from '../../util/artifacts';
import { ContractInstance } from '../../util/types';

const { ZRXToken } = new Artifacts(artifacts);
const web3Instance: Web3 = web3;

contract('ZRXToken', (accounts: string[]) => {
  const owner = accounts[0];
  const spender = accounts[1];

  let zrx: ContractInstance;

  beforeEach(async () => {
    zrx = await ZRXToken.new({ from: owner });
  });

  describe('constants', () => {
    it('should have 18 decimals', async () => {
      const decimals = await zrx.decimals.call();
      const expectedDecimals = '18';
      assert.equal(decimals.toString(), expectedDecimals);
    });

    it('should have a total supply of 1 billion tokens', async () => {
      const totalSupply = await zrx.totalSupply.call();
      const expectedTotalSupply = '1000000000';
      assert.equal(web3Instance.fromWei(totalSupply, 'ether').toString(), expectedTotalSupply.toString());
    });

    it('should be named 0x Protocol Token', async () => {
      const name = await zrx.name.call();
      const expectedName = '0x Protocol Token';
      assert.equal(name, expectedName);
    });

    it('should have the symbol ZRX', async () => {
      const symbol = await zrx.symbol.call();
      const expectedSymbol = 'ZRX';
      assert.equal(symbol, expectedSymbol);
    });
  });

  describe('constructor', () => {
    it('should initialize owner balance to totalSupply', async () => {
      const ownerBalance = await zrx.balanceOf(owner);
      const totalSupply = await zrx.totalSupply.call();
      assert.equal(totalSupply.toString(), ownerBalance.toString());
    });
  });

  describe('transfer', () => {
    it('should transfer balance from sender to receiver', async () => {
      const initOwnerBalance = await zrx.balanceOf(owner);
      const amountToTransfer = new BigNumber(1);
      await zrx.transfer(spender, amountToTransfer, { from: owner });
      const finalOwnerBalance = await zrx.balanceOf(owner);
      const finalSpenderBalance = await zrx.balanceOf(spender);

      const expectedFinalOwnerBalance = initOwnerBalance.minus(amountToTransfer);
      const expectedFinalSpenderBalance = amountToTransfer;
      assert.equal(finalOwnerBalance.toString(), expectedFinalOwnerBalance.toString());
      assert.equal(finalSpenderBalance.toString(), expectedFinalSpenderBalance.toString());
    });

    it('should return true on a 0 value transfer', async () => {
      const didReturnTrue = await zrx.transfer.call(spender, 0, { from: owner });
      assert.equal(didReturnTrue, true);
    });
  });

  describe('approveUnlimited', () => {
    it('should log an event with the correct args', async () => {
      const approval = true;
      const res = await zrx.approveUnlimited(spender, approval, { from: owner });
      const logs = res.logs;
      assert.equal(logs.length, 1);

      const logArgs = logs[0].args;
      assert.equal(logArgs._owner, owner);
      assert.equal(logArgs._spender, spender);
      assert.equal(logArgs._approval, approval);
    });

    it('should update the allowedUnlimited mapping with the correct approval', async () => {
      let approval = true;
      await zrx.approveUnlimited(spender, approval);
      let isApproved = await zrx.unlimitedAllowance(owner, spender);
      assert.equal(isApproved, approval);

      approval = false;
      await zrx.approveUnlimited(spender, approval);
      isApproved = await zrx.unlimitedAllowance(owner, spender);
      assert.equal(isApproved, approval);
    });
  });

  describe('transferFrom', () => {
    it('should return false if owner has insufficient balance', async () => {
      const ownerBalance = await zrx.balanceOf(owner);
      const amountToTransfer = ownerBalance.plus(1);
      await zrx.approve(spender, amountToTransfer, { from: owner });
      const didReturnTrue = await zrx.transferFrom.call(owner, spender, amountToTransfer, { from: spender });
      assert.equal(didReturnTrue, false);
    });

    it('should return false if spender is not allowed unlimited and owner has insufficient allowance', async () => {
      const ownerBalance = await zrx.balanceOf(owner);
      const amountToTransfer = ownerBalance;
      const didReturnTrue = await zrx.transferFrom.call(owner, spender, amountToTransfer, { from: spender });
      assert.equal(didReturnTrue, false);
    });

    it('should return true on a 0 value transfer', async () => {
      const amountToTransfer = 0;
      const didReturnTrue = await zrx.transferFrom.call(owner, spender, amountToTransfer, { from: spender });
      assert.equal(didReturnTrue, true);
    });

    it('should transfer the correct balances if spender is allowed unlimited', async () => {
      const initOwnerBalance = await zrx.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      await zrx.approveUnlimited(spender, true, { from: owner });
      await zrx.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newOwnerBalance = await zrx.balanceOf(owner);
      const newSpenderBalance = await zrx.balanceOf(spender);

      assert.equal(newOwnerBalance.toString(), '0');
      assert.equal(newSpenderBalance.toString(), initOwnerBalance.toString());
    });

    it('should not modify spender allowance if spender is allowed unlimited', async () => {
      const initOwnerBalance = await zrx.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      const initSpenderAllowance = initOwnerBalance;
      await zrx.approveUnlimited(spender, true, { from: owner });
      await zrx.approve(spender, initSpenderAllowance, { from: owner });
      await zrx.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newSpenderAllowance = await zrx.allowance(owner, spender);
      assert.equal(initSpenderAllowance.toString(), newSpenderAllowance.toString());
    });

    it('should transfer the correct balances if spender is not allowed unlimited but has sufficient allowance', async () => {
      const initOwnerBalance = await zrx.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      const initSpenderAllowance = initOwnerBalance;
      await zrx.approve(spender, initSpenderAllowance, { from: owner });
      await zrx.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newOwnerBalance = await zrx.balanceOf(owner);
      const newSpenderBalance = await zrx.balanceOf(spender);

      assert.equal(newOwnerBalance.toString(), '0');
      assert.equal(newSpenderBalance.toString(), initOwnerBalance.toString());
    });

    it('should modify allowance if spender is not allowed unlimited but has sufficient allowance', async () => {
      const initOwnerBalance = await zrx.balanceOf(owner);
      const amountToTransfer = initOwnerBalance;
      const initSpenderAllowance = initOwnerBalance;
      await zrx.approve(spender, initSpenderAllowance, { from: owner });
      await zrx.transferFrom(owner, spender, amountToTransfer, { from: spender });

      const newSpenderAllowance = await zrx.allowance(owner, spender);
      assert.equal(newSpenderAllowance, '0');
    });
  });
});
