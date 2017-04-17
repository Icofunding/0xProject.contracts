const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
const Proxy = artifacts.require('./Proxy.sol');
const Exchange = artifacts.require('./Exchange.sol');
const ProtocolToken = artifacts.require('./ProtocolToken.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');

const multiSigConfig = require('./multisig_config.js');

module.exports = (deployer, network, accounts) => {
  const defaultConfig = {
    owners: [accounts[0], accounts[1]],
    confirmationsRequired: 2,
    secondsRequired: 0,
  };
  const config = multiSigConfig[network] || defaultConfig;
  if (network === 'development') {
    deployer.deploy([
      [MultiSigWallet, config.owners, config.confirmationsRequired, config.secondsRequired],
      Proxy,
      [DummyProtocolToken, 0],
      TokenRegistry,
    ])
    .then(() => deployer.deploy(Exchange, DummyProtocolToken.address, Proxy.address))
    .then(() => Proxy.deployed())
    .then(proxy => proxy.addAuthorizedAddress(Exchange.address, { from: accounts[0] }));
  } else {
    deployer.deploy([
      [MultiSigWallet, config.owners, config.confirmationsRequired, config.secondsRequired],
      Proxy,
      ProtocolToken,
      TokenRegistry,
    ])
    .then(() => deployer.deploy(Exchange, ProtocolToken.address, Proxy.address))
    .then(() => Proxy.deployed())
    .then(proxy => proxy.addAuthorizedAddress(Exchange.address, { from: accounts[0] }));
  }
};
