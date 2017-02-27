var Proxy = artifacts.require('./Proxy.sol');
var Exchange = artifacts.require('./Exchange.sol');
var ProtocolToken = artifacts.require('./ProtocolToken.sol');

module.exports = function(deployer) {
  deployer.deploy(Proxy)
    .then(() => deployer.deploy(ProtocolToken))
    .then(() => deployer.deploy(Exchange, ProtocolToken.address, Proxy.address));
};
