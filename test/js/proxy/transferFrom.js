const Proxy = artifacts.require('./Proxy.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const BNUtil = require('../../../util/BNUtil');
const testUtil = require('../../../util/testUtil');
const util = require('../../../util/index.js')(web3);

const { add, sub } = BNUtil;

contract('Proxy', accounts => {
  const INIT_BAL = 100000000;
  const INIT_ALLOW = 100000000;

  const owner = accounts[0];
  const notAuthorized = owner;

  let proxy;
  let dmyA;

  let getDmyBalances;

  before(async () => {
    [proxy, dmyA] = await Promise.all([
      Proxy.deployed(),
      DummyTokenA.deployed(),
    ]);

    getDmyBalances = util.getBalancesFactory([dmyA], [accounts[0], accounts[1]]);
    await Promise.all([
      dmyA.approve(Proxy.address, INIT_ALLOW, { from: accounts[0] }),
      dmyA.setBalance(INIT_BAL, { from: accounts[0] }),
      dmyA.approve(Proxy.address, INIT_ALLOW, { from: accounts[1] }),
      dmyA.setBalance(INIT_BAL, { from: accounts[1] }),
    ]);
  });

  describe('transferFrom', () => {
    it('should throw when called by an unauthorized address', async () => {
      try {
        await proxy.transferFrom(dmyA.address, accounts[0], accounts[1], 1000, { from: notAuthorized });
        throw new Error('proxy.transferFrom succeeded when it should have thrown');
      } catch (err) {
        testUtil.assertThrow(err);
      }
    });

    it('should allow an authorized address to transfer', async () => {
      const balances = await getDmyBalances();

      await proxy.addAuthorizedAddress(notAuthorized, { from: owner });
      const transferAmt = 10000;
      await proxy.transferFrom(dmyA.address, accounts[0], accounts[1], transferAmt, { from: notAuthorized });

      const newBalances = await getDmyBalances();
      assert.equal(newBalances[accounts[0]][dmyA.address], sub(balances[accounts[0]][dmyA.address], transferAmt));
      assert.equal(newBalances[accounts[1]][dmyA.address], add(balances[accounts[1]][dmyA.address], transferAmt));
    });
  });
});
