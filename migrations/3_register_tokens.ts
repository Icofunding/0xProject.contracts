import * as _ from 'lodash';
import { ContractInstance, TokenInfoByNetwork, Token } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  DummyToken,
  DummyEtherToken,
  ProtocolToken,
  TokenRegistry,
} = new Artifacts(artifacts);
import { tokenInfo } from './config/token_info';

module.exports = (deployer: any, network: string) => {
  const tokens = network === 'live' ? tokenInfo.live : tokenInfo.development;
  deployer.then(() => {
    return TokenRegistry.deployed();
  }).then((tokenRegistry: ContractInstance) => {
    if (network !== 'live') {
      const totalSupply = 100000000 * Math.pow(10, 18);
      return Promise.all(tokens.map((token: Token) => DummyToken.new(
        token.name,
        token.symbol,
        token.decimals,
        totalSupply,
      ))).then((dummyTokens: ContractInstance[]) => {
        const weth = {
          address: DummyEtherToken.address,
          name: 'ETH Token',
          symbol: 'WETH',
          url: '',
          decimals: 18,
          ipfsHash: '0x0',
          swarmHash: '0x0',
        };
        return Promise.all(dummyTokens.map((tokenContract: ContractInstance, i: number) => {
          const token = tokens[i];
          return tokenRegistry.addToken(
            tokenContract.address,
            token.name,
            token.symbol,
            token.url,
            token.decimals,
            token.ipfsHash,
            token.swarmHash,
          );
        }).concat(tokenRegistry.addToken(
          weth.address,
          weth.name,
          weth.symbol,
          weth.url,
          weth.decimals,
          weth.ipfsHash,
          weth.swarmHash,
        )));
      });
    } else {
      const zrx = {
        address: ProtocolToken.address,
        name: '0x Protocol Token',
        symbol: 'ZRX',
        url: 'https://www.0xproject.com/',
        decimals: 18,
        ipfsHash: '0x0',
        swarmHash: '0x0',
      };
      return Promise.all(tokens.map((token: Token) => {
        return tokenRegistry.addToken(
          token.address,
          token.name,
          token.symbol,
          token.url,
          token.decimals,
          token.ipfsHash,
          token.swarmHash,
        );
      }).concat(tokenRegistry.addToken(
        zrx.address,
        zrx.name,
        zrx.symbol,
        zrx.url,
        zrx.decimals,
        zrx.ipfsHash,
        zrx.swarmHash,
      )));
    }
  });
};
