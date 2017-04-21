const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
const Proxy = artifacts.require('./Proxy.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');

module.exports = (deployer, network) => {
  if (network !== 'development') {
    deployer.then(() =>
      Promise.all([
        Proxy.deployed(),
        TokenRegistry.deployed(),
      ]).then(instances => {
        const [proxy, tokenRegistry] = instances;
        return Promise.all([
          proxy.transferOwnership(MultiSigWallet.address),
          tokenRegistry.transferOwnership(MultiSigWallet.address),
        ]);
      })
    );
  }
};
