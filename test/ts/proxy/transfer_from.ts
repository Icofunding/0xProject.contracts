import * as assert from 'assert';
import { Balances } from '../../../util/balances';
import { BNUtil } from '../../../util/bn_util';
import { testUtil } from '../../../util/test_util';
import { ContractInstance } from '../../../util/types';
import { Artifacts } from '../../../util/artifacts';

const {
  Exchange,
  TokenProxy,
  DummyToken,
  TokenRegistry,
} = new Artifacts(artifacts);

const { add, sub } = BNUtil;

contract('TokenProxy', (accounts: string[]) => {
  const INIT_BAL = 100000000;
  const INIT_ALLOW = 100000000;

  const owner = accounts[0];
  const notAuthorized = owner;

  let tokenProxy: ContractInstance;
  let tokenRegistry: ContractInstance;
  let rep: ContractInstance;
  let dmyBalances: Balances;

  before(async () => {
    [tokenProxy, tokenRegistry] = await Promise.all([
      TokenProxy.deployed(),
      TokenRegistry.deployed(),
    ]);
    const repAddress = await tokenRegistry.getTokenAddressBySymbol('REP');
    rep = DummyToken.at(repAddress);

    dmyBalances = new Balances([rep], [accounts[0], accounts[1]]);
    await Promise.all([
      rep.approve(TokenProxy.address, INIT_ALLOW, { from: accounts[0] }),
      rep.setBalance(accounts[0], INIT_BAL, { from: owner }),
      rep.approve(TokenProxy.address, INIT_ALLOW, { from: accounts[1] }),
      rep.setBalance(accounts[1], INIT_BAL, { from: owner }),
    ]);
  });

  describe('transferFrom', () => {
    it('should throw when called by an unauthorized address', async () => {
      try {
        await tokenProxy.transferFrom(rep.address, accounts[0], accounts[1], 1000, { from: notAuthorized });
        throw new Error('tokenProxy.transferFrom succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow an authorized address to transfer', async () => {
      const balances = await dmyBalances.getAsync();

      await tokenProxy.addAuthorizedAddress(notAuthorized, { from: owner });
      const transferAmt = 10000;
      await tokenProxy.transferFrom(rep.address, accounts[0], accounts[1], transferAmt, { from: notAuthorized });

      const newBalances = await dmyBalances.getAsync();
      assert.equal(newBalances[accounts[0]][rep.address], sub(balances[accounts[0]][rep.address], transferAmt));
      assert.equal(newBalances[accounts[1]][rep.address], add(balances[accounts[1]][rep.address], transferAmt));
    });
  });
});
