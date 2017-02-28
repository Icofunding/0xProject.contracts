var DummyTokenA = artifacts.require('./DummyTokenA.sol');
var DummyTokenB = artifacts.require('./DummyTokenB.sol');

module.exports = function(deployer) {
  deployer.deploy(DummyTokenA, web3.toWei(100, 'ether'));
  deployer.deploy(DummyTokenB, web3.toWei(100, 'ether'));
}
