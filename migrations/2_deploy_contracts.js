const Proxy = artifacts.require('./Proxy.sol');
const Exchange = artifacts.require('./Exchange.sol');
const ProtocolToken = artifacts.require('./ProtocolToken.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');

module.exports = function(deployer, network) {
  if (network !== 'live') {
    deployer.deploy(Proxy)
      .then(() => deployer.deploy(DummyProtocolToken, 0))
      .then(() => deployer.deploy(Exchange, DummyProtocolToken.address, Proxy.address));
  } else {
    deployer.deploy(Proxy)
    .then(() => deployer.deploy(ProtocolToken))
    .then(() => deployer.deploy(Exchange, ProtocolToken.address, Proxy.address));
  }
};
