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
        [EtherToken, 10000000],
    ])
    .then(() => TokenRegistry.deployed())
    .then(tokenRegistryInstance => {
      tokenRegistry = tokenRegistryInstance;
    })
    .then(() => DummyTokenA.deployed())
    .then(dummyTokenA => (
      Promise.all([
        dummyTokenA.symbol(),
        dummyTokenA.name(),
      ])
    ))
    .then(results => {
      [symbol, name] = results;
      const numDecimals = 0;
      tokenRegistry.addToken(DummyTokenA.address, symbol, name, numDecimals);
    })
    .then(() => DummyTokenB.deployed())
    .then(dummyTokenB => (
      Promise.all([
        dummyTokenB.symbol(),
        dummyTokenB.name(),
      ])
    ))
    .then(results => {
      [symbol, name] = results;
      const numDecimals = 0;
      tokenRegistry.addToken(DummyTokenB.address, symbol, name, numDecimals);
    })
    .then(() => EtherToken.deployed())
    .then(etherToken => (
      Promise.all([
        etherToken.symbol(),
        etherToken.name(),
      ])
    ))
    .then(results => {
      [symbol, name] = results;
      const numDecimals = 0;
      tokenRegistry.addToken(EtherToken.address, symbol, name, numDecimals);
    });
  }
};
