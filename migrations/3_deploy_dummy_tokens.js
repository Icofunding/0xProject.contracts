const DummyTokenA = artifacts.require('./DummyTokenA.sol');
const DummyTokenB = artifacts.require('./DummyTokenB.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');

module.exports = function(deployer) {
  deployer.deploy(DummyTokenA, web3.toWei(100, 'ether'));
  deployer.deploy(DummyTokenB, web3.toWei(100, 'ether'));
  deployer.deploy(DummyProtocolToken);
}
