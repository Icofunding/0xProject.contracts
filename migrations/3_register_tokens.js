const TokenRegistry = artifacts.require('./TokenRegistry.sol');
const DummyEtherToken = artifacts.require('./DummyEtherToken.sol');
const DummyToken = artifacts.require('./DummyToken.sol');
const ProtocolToken = artifacts.require('./ProtocolToken.sol');
const tokenData = require('./tokens.js');

module.exports = (deployer, network) => {
  const tokens = network === 'live' ? tokenData.live : tokenData.development;
  const tokenSymbols = Object.keys(tokens);
  deployer.then(() =>
    TokenRegistry.deployed().then(tokenRegistry => {
      if (network !== 'live') {
        const totalSupply = 100000000;
        return Promise.all(tokenSymbols.map(sym => DummyToken.new(
          tokens[sym].name,
          tokens[sym].symbol,
          tokens[sym].decimals,
          totalSupply
        ))).then(instances => {
          const weth = {
            address: DummyEtherToken.address,
            name: 'ETH Wrapper Token',
            symbol: 'WETH',
            url: '',
            decimals: 18,
            ipfsHash: '0x0',
            swarmHash: '0x0',
          };
          return Promise.all(instances.map((tokenContract, i) => tokenRegistry.addToken(
            tokenContract.address,
            tokens[tokenSymbols[i]].name,
            tokens[tokenSymbols[i]].symbol,
            tokens[tokenSymbols[i]].url,
            tokens[tokenSymbols[i]].decimals,
            tokens[tokenSymbols[i]].ipfsHash,
            tokens[tokenSymbols[i]].swarmHash
          )).concat(tokenRegistry.addToken(
            weth.address,
            weth.name,
            weth.symbol,
            weth.url,
            weth.decimals,
            weth.ipfsHash,
            weth.swarmHash
          )));
        });
      }
      const zrx = {
        address: ProtocolToken.address,
        name: '0x Protocol Token',
        symbol: 'ZRX',
        url: 'https://www.0xproject.com/',
        decimals: 18,
        ipfsHash: '0x0',
        swarmHash: '0x0',
      };
      return Promise.all(tokenSymbols.map(sym => tokenRegistry.addToken(
        tokens[sym].address,
        tokens[sym].name,
        tokens[sym].symbol,
        tokens[sym].url,
        tokens[sym].decimals,
        tokens[sym].ipfsHash,
        tokens[sym].swarmHash
      )).concat(tokenRegistry.addToken(
        zrx.address,
        zrx.name,
        zrx.symbol,
        zrx.url,
        zrx.decimals,
        zrx.ipfsHash,
        zrx.swarmHash
      )));
    })
  );
};
