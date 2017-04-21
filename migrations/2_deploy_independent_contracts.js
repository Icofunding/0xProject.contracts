const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
const Proxy = artifacts.require('./Proxy.sol');
const ProtocolToken = artifacts.require('./ProtocolToken.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');
const DummyEtherToken = artifacts.require('./DummyEtherToken.sol');

let multiSigConfig;
try {
  multiSigConfig = require('./multisig_config.js'); // eslint-disable-line global-require
} catch (e) {
  multiSigConfig = {};
}

module.exports = (deployer, network, accounts) => {
  const defaultConfig = {
    owners: [accounts[0], accounts[1]],
    confirmationsRequired: 2,
    secondsRequired: 0,
  };
  const config = multiSigConfig[network] || defaultConfig;
  if (network !== 'live') {
    deployer.deploy([
      [MultiSigWallet, config.owners, config.confirmationsRequired, config.secondsRequired],
      Proxy,
      TokenRegistry,
      DummyEtherToken,
    ]);
  } else {
    deployer.deploy([
      [MultiSigWallet, config.owners, config.confirmationsRequired, config.secondsRequired],
      Proxy,
      TokenRegistry,
      ProtocolToken,
    ]);
  }
};
