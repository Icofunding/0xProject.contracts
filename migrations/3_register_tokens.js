const TokenRegistry = artifacts.require('./TokenRegistry.sol');
const DummyEtherToken = artifacts.require('./DummyEtherToken.sol');
const DummyToken = artifacts.require('./DummyToken.sol');
const ProtocolToken = artifacts.require('./ProtocolToken.sol');
const tokenData = require('./config/tokens.js');

module.exports = (deployer, network) => {
  const tokens = network === 'live' ? tokenData.live : tokenData.development;
  const tokenSymbols = Object.keys(tokens);
  deployer.then(() =>
    TokenRegistry.deployed().then(tokenRegistry => {
      if (network !== 'live') {
        const totalSupply = 100000000 * Math.pow(10, 18); // eslint-disable-line no-restricted-properties
        return Promise.all(tokenSymbols.map(sym => DummyToken.new(
          tokens[sym].name,
          tokens[sym].symbol,
          tokens[sym].decimals,
          totalSupply
        ))).then(instances => {
          const weth = {
            address: DummyEtherToken.address,
            name: 'ETH Token',
            symbol: 'WETH',
            url: '',
            decimals: 18,
            ipfsHash: '0x0',
            swarmHash: '0x0',
          };
          return Promise.all(instances.map((tokenContract, i) => {
            const token = tokens[tokenSymbols[i]];
            return tokenRegistry.addToken(
              tokenContract.address,
              token.name,
              token.symbol,
              token.url,
              token.decimals,
              token.ipfsHash,
              token.swarmHash
            );
          }).concat(tokenRegistry.addToken(
            weth.address,
            weth.name,
            weth.symbol,
            weth.url,
            weth.decimals,
            weth.ipfsHash,
            weth.swarmHash
          )));
        });
      } else { // eslint-disable-line no-else-return
        const zrx = {
          address: ProtocolToken.address,
          name: '0x Protocol Token',
          symbol: 'ZRX',
          url: 'https://www.0xproject.com/',
          decimals: 18,
          ipfsHash: '0x0',
          swarmHash: '0x0',
        };
        return Promise.all(tokenSymbols.map(sym => {
          const token = tokens[sym];
          return tokenRegistry.addToken(
            token.address,
            token.name,
            token.symbol,
            token.url,
            token.decimals,
            token.ipfsHash,
            token.swarmHash
          );
        }).concat(tokenRegistry.addToken(
          zrx.address,
          zrx.name,
          zrx.symbol,
          zrx.url,
          zrx.decimals,
          zrx.ipfsHash,
          zrx.swarmHash
        )));
      }
    })
  );
};
