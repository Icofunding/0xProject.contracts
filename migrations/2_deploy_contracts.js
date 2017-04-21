const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
const Proxy = artifacts.require('./Proxy.sol');
const Exchange = artifacts.require('./Exchange.sol');
const ProtocolToken = artifacts.require('./ProtocolToken.sol');
const DummyToken = artifact.require('./DummyToken.sol');
const TokenRegistry = artifacts.require('./TokenRegistry.sol');
const tokenData = require('./tokens.js');

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
    const { name, symbol, url, decimals, ipfsHash, swarmHash } = tokenData.development.ZRX;
    const totalSupply = 100000000;
    deployer.deploy([
      [MultiSigWallet, config.owners, config.confirmationsRequired, config.secondsRequired],
      Proxy,
      TokenRegistry,
    ])
    .then(() => {
      Promise.all([
        DummyToken.new(name, symbol, decimals, totalSupply),
        TokenRegistry.deployed(),
        Proxy.deployed(),
      ]).then(instances => {
        const [protocolToken, tokenReg, proxy] = instances;
        const ptAddress = protocolToken.address;
        Promise.all([
          deployer.deploy(Exchange, ptAddress, Proxy.address),
          tokenReg.addToken(
            ptAddress,
            name,
            symbol,
            url,
            decimals,
            ipfsHash,
            swarmHash
          ),
        ]).then(res => {
          const exchangeAddress = res[0].address;
          proxy.addAuthorizedAddress(exchangeAddress);
        });
      });
    });
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
