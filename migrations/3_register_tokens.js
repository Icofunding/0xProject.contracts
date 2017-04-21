const TokenRegistry = artifacts.require('./TokenRegistry.sol');
const DummyToken = artifacts.require('./DummyToken.sol');
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
        ))).then(instances =>
          Promise.all(instances.map((tokenContract, i) => tokenRegistry.addToken(
            tokenContract.address,
            tokens[tokenSymbols[i]].name,
            tokens[tokenSymbols[i]].symbol,
            tokens[tokenSymbols[i]].url,
            tokens[tokenSymbols[i]].decimals,
            tokens[tokenSymbols[i]].ipfsHash,
            tokens[tokenSymbols[i]].swarmHash
          )))
        );
      }
      return Promise.all(tokenSymbols.map(sym => tokenRegistry.addToken(
        tokens[sym].address,
        tokens[sym].name,
        tokens[sym].symbol,
        tokens[sym].url,
        tokens[sym].decimals,
        tokens[sym].ipfsHash,
        tokens[sym].swarmHash
      )));
    })
  );
};
