import * as assert from 'assert';
import { Artifacts } from '../../util/artifacts';
import { crypto } from '../../util/crypto';
import { MultiSigWrapper } from '../../util/multi_sig_wrapper';
import { ContractInstance, TransactionDataParams } from '../../util/types';
import { testUtil } from '../../util/test_util';
import * as proxyJSON from '../../build/contracts/Proxy.json';
const { Proxy, ProxyOwner } = new Artifacts(artifacts);
const PROXY_ABI = (proxyJSON as any).abi;

contract('ProxyOwner', (accounts: string[]) => {
  const owners = [accounts[0], accounts[1]];
  const authorizedAddress = accounts[0];
  const unauthorizedAddress = accounts[1];
  const required = 2;
  const SECONDS_TIME_LOCKED = 1000000;

  let proxy: ContractInstance;
  let proxyOwner: ContractInstance;
  let multiSigWrapper: MultiSigWrapper;

  let validDestination: string;

  beforeEach(async () => {
    const initialOwner = accounts[0];
    proxy = await Proxy.new({ from: initialOwner });
    await proxy.addAuthorizedAddress(authorizedAddress, { from: initialOwner });
    proxyOwner = await ProxyOwner.new(owners, required, SECONDS_TIME_LOCKED, proxy.address);
    await proxy.transferOwnership(proxyOwner.address, { from: initialOwner });
    multiSigWrapper = new MultiSigWrapper(proxyOwner);
    validDestination = proxy.address;
  });

  describe('isFunctionRemoveAuthorizedAddress', () => {
    it('should throw if data is not for removeAuthorizedAddress', async () => {
      const data = multiSigWrapper.encodeFnArgs('addAuthorizedAddress', PROXY_ABI, [owners[0]]);
      try {
        await proxyOwner.isFunctionRemoveAuthorizedAddress.call(data);
        throw new Error('isFunctionRemoveAuthorizedAddress succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should return true if data is for removeAuthorizedAddress', async () => {
      const data = multiSigWrapper.encodeFnArgs('removeAuthorizedAddress', PROXY_ABI, [owners[0]]);
      const isFunctionRemoveAuthorizedAddress = await proxyOwner.isFunctionRemoveAuthorizedAddress.call(data);
      assert.equal(isFunctionRemoveAuthorizedAddress, true);
    });
  });

  describe('executeRemoveAuthorizedAddress', () => {
    it('should throw without the required confirmations', async () => {
      const dataParams: TransactionDataParams = {
        name: 'removeAuthorizedAddress',
        abi: PROXY_ABI,
        args: [authorizedAddress],
      };
      const res = await multiSigWrapper.submitTransactionAsync(validDestination, owners[0], dataParams);
      const txId = res.logs[0].args.transactionId.toString();

      try {
        await proxyOwner.executeRemoveAuthorizedAddress(txId);
        throw new Error('executeRemoveAuthorizedAddress succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if tx destination is not the proxy', async () => {
      const invalidProxy = await Proxy.new();
      const invalidDestination = invalidProxy.address;
      const dataParams: TransactionDataParams = {
        name: 'removeAuthorizedAddress',
        abi: PROXY_ABI,
        args: [authorizedAddress],
      };
      const res = await multiSigWrapper.submitTransactionAsync(invalidDestination, owners[0], dataParams);
      const txId = res.logs[0].args.transactionId.toString();
      await proxyOwner.confirmTransaction(txId, { from: owners[1] });
      const isConfirmed = await proxyOwner.isConfirmed.call(txId);
      assert.equal(isConfirmed, true);

      try {
        await proxyOwner.executeRemoveAuthorizedAddress(txId);
        throw new Error('executeRemoveAuthorizedAddress succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should throw if tx data is not for removeAuthorizedAddress', async () => {
      const dataParams: TransactionDataParams = {
        name: 'addAuthorizedAddress',
        abi: PROXY_ABI,
        args: [unauthorizedAddress],
      };
      const res = await multiSigWrapper.submitTransactionAsync(validDestination, owners[0], dataParams);
      const txId = res.logs[0].args.transactionId.toString();
      await proxyOwner.confirmTransaction(txId, { from: owners[1] });
      const isConfirmed = await proxyOwner.isConfirmed.call(txId);
      assert.equal(isConfirmed, true);

      try {
        await proxyOwner.executeRemoveAuthorizedAddress(txId);
        throw new Error('executeRemoveAuthorizedAddress succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should execute removeAuthorizedAddress for valid proxy if fully confirmed', async () => {
      const dataParams: TransactionDataParams = {
        name: 'removeAuthorizedAddress',
        abi: PROXY_ABI,
        args: [authorizedAddress],
      };
      const res = await multiSigWrapper.submitTransactionAsync(validDestination, owners[0], dataParams);
      const txId = res.logs[0].args.transactionId.toString();
      await proxyOwner.confirmTransaction(txId, { from: owners[1] });
      const isConfirmed = await proxyOwner.isConfirmed.call(txId);
      assert.equal(isConfirmed, true);
      await proxyOwner.executeRemoveAuthorizedAddress(txId);

      const isAuthorized = await proxy.authorized.call(authorizedAddress);
      assert.equal(isAuthorized, false);
    });

    it('should throw if already executed', async () => {
      const dataParams: TransactionDataParams = {
        name: 'removeAuthorizedAddress',
        abi: PROXY_ABI,
        args: [authorizedAddress],
      };
      const res = await multiSigWrapper.submitTransactionAsync(validDestination, owners[0], dataParams);
      const txId = res.logs[0].args.transactionId.toString();
      await proxyOwner.confirmTransaction(txId, { from: owners[1] });
      const isConfirmed = await proxyOwner.isConfirmed.call(txId);
      assert.equal(isConfirmed, true);
      await proxyOwner.executeRemoveAuthorizedAddress(txId);
      const tx = await proxyOwner.transactions.call(txId);
      const isExecuted = tx[3];
      assert.equal(isExecuted, true);

      try {
        await proxyOwner.executeRemoveAuthorizedAddress(txId);
        throw new Error('executeRemoveAuthorizedAddress succeeded when it should have failed');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });
  });
});
