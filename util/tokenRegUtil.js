module.exports = tokenReg => {
  const addToken = ({
    tokenAddress,
    name,
    symbol,
    url = '',
    decimals,
    ipfsHash = '0x0',
    swarmHash = '0x0',
  }, { from }) => {
    const tx = tokenReg.addToken(
      tokenAddress,
      name,
      symbol,
      url,
      decimals,
      ipfsHash,
      swarmHash,
      { from }
    );
    return tx;
  };

  const getTokenMetaData = async tokenAddress => {
    const data = await tokenReg.getTokenMetaData(tokenAddress);
    const token = {
      tokenAddress: data[0],
      name: data[1],
      symbol: data[2],
      url: data[3],
      decimals: data[4].toNumber(),
      ipfsHash: data[5],
      swarmHash: data[6],
    };
    return token;
  };

  const getTokenByName = async tokenName => {
    const data = await tokenReg.getTokenByName(tokenName);
    const token = {
      tokenAddress: data[0],
      name: data[1],
      symbol: data[2],
      url: data[3],
      decimals: data[4].toNumber(),
      ipfsHash: data[5],
      swarmHash: data[6],
    };
    return token;
  };

  const getTokenBySymbol = async tokenSymbol => {
    const data = await tokenReg.getTokenBySymbol(tokenSymbol);
    const token = {
      tokenAddress: data[0],
      name: data[1],
      symbol: data[2],
      url: data[3],
      decimals: data[4].toNumber(),
      ipfsHash: data[5],
      swarmHash: data[6],
    };
    return token;
  };

  return {
    addToken,
    getTokenMetaData,
    getTokenByName,
    getTokenBySymbol,
  };
};
