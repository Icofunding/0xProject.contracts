const Proxy = artifacts.require('./Proxy.sol');
const DummyToken = artifacts.require('./DummyToken.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');
const BNUtil = require('../../../util/bn_util');
const testUtil = require('../../../util/test_util');
const Balances = require('../../../util/balances');

const { add, sub } = BNUtil;

contract('Proxy', accounts => {
  const INIT_BAL = 100000000;
  const INIT_ALLOW = 100000000;

  const owner = accounts[0];
  const notAuthorized = owner;

  let proxy;
  let tokenRegistry;
  let rep;

  let dmyBalances;

  before(async () => {
    [proxy, tokenRegistry] = await Promise.all([
      Proxy.deployed(),
      TokenRegistry.deployed(),
    ]);
    const repAddress = await tokenRegistry.getTokenAddressBySymbol('REP');
    rep = DummyToken.at(repAddress);

    dmyBalances = new Balances([rep], [accounts[0], accounts[1]]);
    await Promise.all([
      rep.approve(Proxy.address, INIT_ALLOW, { from: accounts[0] }),
      rep.setBalance(accounts[0], INIT_BAL, { from: owner }),
      rep.approve(Proxy.address, INIT_ALLOW, { from: accounts[1] }),
      rep.setBalance(accounts[1], INIT_BAL, { from: owner }),
    ]);
  });

  describe('transferFrom', () => {
    it('should throw when called by an unauthorized address', async () => {
      try {
        await proxy.transferFrom(rep.address, accounts[0], accounts[1], 1000, { from: notAuthorized });
        throw new Error('proxy.transferFrom succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow an authorized address to transfer', async () => {
      const balances = await dmyBalances.getAsync();

      await proxy.addAuthorizedAddress(notAuthorized, { from: owner });
      const transferAmt = 10000;
      await proxy.transferFrom(rep.address, accounts[0], accounts[1], transferAmt, { from: notAuthorized });

      const newBalances = await dmyBalances.getAsync();
      assert.equal(newBalances[accounts[0]][rep.address], sub(balances[accounts[0]][rep.address], transferAmt));
      assert.equal(newBalances[accounts[1]][rep.address], add(balances[accounts[1]][rep.address], transferAmt));
    });
  });
});
