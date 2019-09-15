import * as _ from 'lodash';
import * as Bluebird from 'bluebird';
import {ContractInstance, TokenInfoByNetwork, Token} from '../util/types';
import {Artifacts} from '../util/artifacts';
const {
  DummyToken,
  EtherToken,
  ZRXToken,
  TokenRegistry,
} = new Artifacts(artifacts);
import {tokenInfo} from './config/token_info';
import {constants} from '../util/constants';

module.exports = (deployer: any, network: string) => {
  const tokens = network === 'live' ? tokenInfo.live : tokenInfo.development;
  deployer.then(() => {
    return TokenRegistry.deployed();
  }).then((tokenRegistry: ContractInstance) => {
    if (network !== 'live') {
      const totalSupply = 1000000000 * Math.pow(10, 18);
      return Bluebird.each(tokens.map((token: Token) => DummyToken.new(
        token.name,
        token.symbol,
        token.decimals,
        totalSupply,
    )), _.noop).then((dummyTokens: ContractInstance[]) => {
        const weth = {
          address: EtherToken.address,
          name: 'Ether Token',
          symbol: 'WETH',
          url: '',
          decimals: 18,
          ipfsHash: constants.NULL_BYTES,
          swarmHash: constants.NULL_BYTES,
        };
        return Bluebird.each(dummyTokens.map((tokenContract: ContractInstance, i: number) => {
          const token = tokens[i];
          return tokenRegistry.addToken(
            tokenContract.address,
            token.name,
            token.symbol,
            token.decimals,
            token.ipfsHash,
            token.swarmHash,
          );
        }).concat(tokenRegistry.addToken(
          weth.address,
          weth.name,
          weth.symbol,
          weth.decimals,
          weth.ipfsHash,
          weth.swarmHash,
      )), _.noop);
      });
    } else {
      const zrx = {
        address: ZRXToken.address,
        name: '0x Protocol Token',
        symbol: 'ZRX',
        url: 'https://www.0xproject.com/',
        decimals: 18,
        ipfsHash: constants.NULL_BYTES,
        swarmHash: constants.NULL_BYTES,
      };
      return Bluebird.each(tokens.map((token: Token) => {
        return tokenRegistry.addToken(
          token.address,
          token.name,
          token.symbol,
          token.decimals,
          token.ipfsHash,
          token.swarmHash,
        );
      }).concat(tokenRegistry.addToken(
        zrx.address,
        zrx.name,
        zrx.symbol,
        zrx.decimals,
        zrx.ipfsHash,
        zrx.swarmHash,
    )), _.noop);
    }
  });
};
