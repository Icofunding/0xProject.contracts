const TokenRegistry = artifacts.require('./TokenRegistry.sol');
const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const DummyTokenB = artifacts.require('./DummyTokenB.sol');
const EtherToken = artifacts.require('./EtherToken.sol');

let tokenRegistry;
module.exports = (deployer, network) => {
  if (network !== 'live') {
    deployer.deploy([
        [DummyTokenA, 10000000],
        [DummyTokenB, 10000000],
        [EtherToken],
    ])
    .then(() => (
        Promise.all([
          TokenRegistry.deployed(),
          DummyTokenA.deployed(),
          DummyTokenB.deployed(),
          EtherToken.deployed(),
        ])
    ))
    .then(contracts => {
      [tokenRegistry, dummyTokenA, dummyTokenB, etherToken] = contracts;
      return Promise.all([
        dummyTokenA.symbol(),
        dummyTokenA.name(),
        dummyTokenB.symbol(),
        dummyTokenB.name(),
        etherToken.symbol(),
        etherToken.name(),
        etherToken.decimals(),
      ]);
    })
    .then(tokenInfo => {
      [
        dummyTokenASymbol,
        dummyTokenAName,
        dummyTokenBSymbol,
        dummyTokenBName,
        etherTokenSymbol,
        etherTokenName,
        etherTokenDecimals,
      ] = tokenInfo;
      const numDecimals = 0;

      Promise.all([
        tokenRegistry.addToken(DummyTokenA.address, dummyTokenASymbol, dummyTokenAName, numDecimals),
        tokenRegistry.addToken(DummyTokenA.address, dummyTokenBSymbol, dummyTokenBName, numDecimals),
        tokenRegistry.addToken(EtherToken.address, etherTokenSymbol, etherTokenName, etherTokenDecimals),
      ]);
    });
  }
};
