const Proxy = artifacts.require('./Proxy.sol');
const Exchange = artifacts.require('./Exchange.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');

module.exports = deployer => {
  Promise.all([
    Proxy.deployed(),
    TokenRegistry.deployed(),
  ]).then(instances => {
    const [proxy, tokenRegistry] = instances;
    tokenRegistry.getTokenAddressBySymbol('ZRX').then(ptAddress =>
      deployer.deploy(Exchange, ptAddress, proxy.address).then(() => {
        proxy.addAuthorizedAddress(Exchange.address);
      })
    );
  });
};
