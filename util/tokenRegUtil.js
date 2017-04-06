module.exports = tokenReg => {
  const addToken = (token, { from }) => tokenReg.addToken(
    token.tokenAddress,
    token.name,
    token.symbol,
    token.url,
    token.decimals,
    token.ipfsHash,
    token.swarmHash,
    { from }
  );

  const removeToken = (tokenAddress, { from }) => tokenReg.removeToken(tokenAddress, { from });

  const getTokenMetaData = tokenAddress => {
    const token = new Promise((resolve, reject) => {
      tokenReg.getTokenMetaData(tokenAddress).then(data => {
        const ret = {
          tokenAddress: data[0],
          name: data[1],
          symbol: data[2],
          url: data[3],
          decimals: data[4].toNumber(),
          ipfsHash: data[5],
          swarmHash: data[6],
        };
        resolve(ret);
      }).catch(e => reject(e));
    });
    return token;
  };

  const getTokenByName = tokenName => {
    const token = new Promise((resolve, reject) => {
      tokenReg.getTokenByName(tokenName).then(data => {
        const ret = {
          tokenAddress: data[0],
          name: data[1],
          symbol: data[2],
          url: data[3],
          decimals: data[4],
          ipfsHash: data[5],
          swarmHash: data[6],
        };
        resolve(ret);
      }).catch(e => reject(e));
    });
    return token;
  };

  const getTokenBySymbol = tokenSymbol => {
    const token = new Promise((resolve, reject) => {
      tokenReg.getTokenBySymbol(tokenSymbol).then(data => {
        const ret = {
          tokenAddress: data[0],
          name: data[1],
          symbol: data[2],
          url: data[3],
          decimals: data[4],
          ipfsHash: data[5],
          swarmHash: data[6],
        };
        resolve(ret);
      }).catch(e => reject(e));
    });
    return token;
  };

  return {
    addToken,
    removeToken,
    getTokenMetaData,
    getTokenByName,
    getTokenBySymbol,
  };
};
