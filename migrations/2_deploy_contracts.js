const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
const Proxy = artifacts.require('./Proxy.sol');
const Exchange = artifacts.require('./Exchange.sol');
const ProtocolToken = artifacts.require('./ProtocolToken.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');

module.exports = (deployer, network, accounts) => {
  if (network !== 'live') {
    deployer.deploy([
      [MultiSigWallet, [accounts[0], accounts[1]], 2],
      Proxy,
      [DummyProtocolToken, 0],
      TokenRegistry,
    ])
    .then(() => deployer.deploy(Exchange, DummyProtocolToken.address, Proxy.address))
    .then(() => Proxy.deployed())
    .then(proxy => proxy.addAuthorizedAddress(Exchange.address, { from: accounts[0] }));
  } else {
    deployer.deploy(Proxy)
    .then(() => deployer.deploy(ProtocolToken))
    .then(() => deployer.deploy(Exchange, ProtocolToken.address, Proxy.address))
    .then(() => Proxy.deployed())
    .then(proxy => proxy.setAuthorization(Exchange.address, true, { from: web3.eth.accounts[0] }));
  }
};
