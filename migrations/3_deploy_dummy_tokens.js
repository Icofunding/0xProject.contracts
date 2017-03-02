const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const DummyTokenB = artifacts.require('./DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');

module.exports = function(deployer, network) {
  if (network !== 'live') {
    deployer.deploy(DummyTokenA, 0);
    deployer.deploy(DummyTokenB, 0);
  }
}
