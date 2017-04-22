class TokenRegWrapper {
  constructor(tokenRegContractInstance) {
    this._tokenReg = tokenRegContractInstance;
  }
  addToken({
    tokenAddress,
    name,
    symbol,
    url = '',
    decimals,
    ipfsHash = '0x0',
    swarmHash = '0x0',
  }, { from }) {
    const tx = this._tokenReg.addToken(
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
  }
  async getTokenMetaData(tokenAddress) {
    const data = await this._tokenReg.getTokenMetaData(tokenAddress);
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
  }
  async getTokenByName(tokenName) {
    const data = await this._tokenReg.getTokenByName(tokenName);
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
  }
  async getTokenBySymbol(tokenSymbol) {
    const data = await this._tokenReg.getTokenBySymbol(tokenSymbol);
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
  }
}

module.exports = TokenRegWrapper;
