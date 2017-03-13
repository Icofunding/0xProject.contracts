const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const DummyTokenB = artifacts.require('./DummyTokenB.sol');

module.exports = (deployer, network) => {
  if (network !== 'live') {
    deployer.deploy(DummyTokenA, 0);
    deployer.deploy(DummyTokenB, 0);
  }
};
