const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
const Proxy = artifacts.require('./Proxy.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');

module.exports = (deployer, network, accounts) => {
  if (network !== 'development') {
    Promise.all([
      Proxy.deployed(),
      TokenRegistry.deployed(),
    ]).then(instances => {
      const [proxy, tokenReg] = instances;
      return Promise.all([
        proxy.transferOwnership(MultiSigWallet.address, { from: accounts[0] }),
        tokenReg.transferOwnership(MultiSigWallet.address, { from: accounts[0] }),
      ]);
    });
  }
};
