const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
const Proxy = artifacts.require('./Proxy.sol');
const ExchangeMath = artifacts.require('./util/ExchangeMath.sol');
const ExchangeCrypto = artifacts.require('./util/ExchangeCrypto.sol');
const Exchange = artifacts.require('./Exchange.sol');
const ExchangeWrapper = artifacts.require('./ExchangeWrapper.sol');
const ProtocolToken = artifacts.require('./ProtocolToken.sol');
const DummyProtocolToken = artifacts.require('./DummyProtocolToken.sol');

module.exports = (deployer, network) => {
  if (network !== 'live') {
    const accounts = web3.eth.accounts;
    deployer.deploy([
      [MultiSigWallet, [accounts[0], accounts[1]], 2],
      Proxy,
      [DummyProtocolToken, 0],
      ExchangeMath,
      ExchangeCrypto,
    ])
    .then(() => deployer.deploy(Exchange, DummyProtocolToken.address, Proxy.address))
    .then(() => deployer.deploy(ExchangeWrapper, Exchange.address))
    .then(() => Proxy.deployed())
    .then(instance => {
      const proxy = instance;
      proxy.setAuthorization(Exchange.address, true, { from: accounts[0] })
      .then(() => proxy.transferOwnership(MultiSigWallet.address, { from: accounts[0] }));
    });
  } else {
    deployer.deploy(Proxy)
    .then(() => deployer.deploy(ProtocolToken))
    .then(() => deployer.deploy(Exchange, ProtocolToken.address, Proxy.address))
    .then(() => Proxy.deployed())
    .then(proxy => proxy.setAuthorization(Exchange.address, true, { from: web3.eth.accounts[0] }));
  }
};
