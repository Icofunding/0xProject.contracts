const Proxy = artifacts.require('./Proxy.sol');
const Exchange = artifacts.require('./Exchange.sol');
const ProtocolToken = artifacts.require('./ProtocolToken.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');

module.exports = function(deployer, network) {
  if (network !== 'live') {
    deployer.deploy(Proxy)
      .then(() => deployer.deploy(DummyProtocolToken, 0))
      .then(() => deployer.deploy(Exchange, DummyProtocolToken.address, Proxy.address))
      .then(() => Proxy.deployed())
      .then(proxy => proxy.setAuthorization(Exchange.address, true, { from: web3.eth.accounts[0] }));
  } else {
    deployer.deploy(Proxy)
    .then(() => deployer.deploy(ProtocolToken))
    .then(() => deployer.deploy(Exchange, ProtocolToken.address, Proxy.address))
    .then(() => Proxy.deployed())
    .then(proxy => proxy.setAuthorization(Exchange.address, true, { from: web3.eth.accounts[0] }));
  }
};
