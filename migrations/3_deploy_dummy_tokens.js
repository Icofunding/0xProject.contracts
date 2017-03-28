const TokenRegistry = artifacts.require('./TokenRegistry.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const DummyTokenB = artifacts.require('./DummyTokenB.sol');
const DummyEtherToken = artifacts.require('./DummyEtherToken.sol');

let tokenRegistry;
module.exports = (deployer, network) => {
  if (network !== 'live') {
    deployer.deploy([
        [DummyTokenA, 10000000],
        [DummyTokenB, 10000000],
        [DummyEtherToken],
    ])
    .then(() => (
        Promise.all([
          TokenRegistry.deployed(),
          DummyTokenA.deployed(),
          DummyTokenB.deployed(),
          DummyEtherToken.deployed(),
        ])
    ))
    .then(contracts => {
      [tokenRegistry, dummyTokenA, dummyTokenB, dummyEtherToken] = contracts;
      return Promise.all([
        dummyTokenA.symbol(),
        dummyTokenA.name(),
        dummyTokenB.symbol(),
        dummyTokenB.name(),
        dummyEtherToken.symbol(),
        dummyEtherToken.name(),
        dummyEtherToken.decimals(),
      ]);
    })
    .then(tokenInfo => {
      [
        dummyTokenASymbol,
        dummyTokenAName,
        dummyTokenBSymbol,
        dummyTokenBName,
        dummyEtherTokenSymbol,
        dummyEtherTokenName,
        dummyEtherTokenDecimals,
      ] = tokenInfo;
      const numDecimals = 0;

      Promise.all([
        tokenRegistry.addToken(DummyTokenA.address, dummyTokenASymbol, dummyTokenAName, numDecimals),
        tokenRegistry.addToken(DummyTokenB.address, dummyTokenBSymbol, dummyTokenBName, numDecimals),
        tokenRegistry.addToken(DummyEtherToken.address, dummyEtherTokenSymbol, dummyEtherTokenName, dummyEtherTokenDecimals),
      ]);
    });
  }
};
