import { ContractInstance } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  DummyTokenA,
  DummyTokenB,
  DummyEtherToken,
  TokenRegistry,
} = new Artifacts(artifacts);

let tokenRegistry: ContractInstance;
module.exports = (deployer: any, network: string) => {
  if (network !== 'live') {
    deployer.deploy([
        [DummyTokenA, 1000000000000000000000],
        [DummyTokenB, 1000000000000000000000],
        [DummyEtherToken],
    ])
    .then(() => (
        Promise.all([
          TokenRegistry.deployed(),
          DummyTokenA.deployed(),
          DummyTokenB.deployed(),
          DummyEtherToken.deployed(),
        ])
    ))
    .then((contracts: ContractInstance[]) => {
      let dummyTokenA: ContractInstance;
      let dummyTokenB: ContractInstance;
      let dummyEtherToken: ContractInstance;
      [tokenRegistry, dummyTokenA, dummyTokenB, dummyEtherToken] = contracts;
      return Promise.all([
        dummyTokenA.symbol(),
        dummyTokenA.name(),
        dummyTokenB.symbol(),
        dummyTokenB.name(),
        dummyEtherToken.symbol(),
        dummyEtherToken.name(),
        dummyEtherToken.decimals(),
      ]);
    })
    .then((tokenInfo: any[]) => {
      const [
        dummyTokenASymbol,
        dummyTokenAName,
        dummyTokenBSymbol,
        dummyTokenBName,
        dummyEtherTokenSymbol,
        dummyEtherTokenName,
        dummyEtherTokenDecimals,
      ] = tokenInfo;
      const numDecimals = 18;
      const ipfsHash = '0x0';
      const swarmHash = '0x0';
      const url = '';
      Promise.all([
        tokenRegistry.addToken(
          DummyTokenA.address,
          dummyTokenAName,
          dummyTokenASymbol,
          url,
          numDecimals,
          ipfsHash,
          swarmHash),
        tokenRegistry.addToken(
          DummyTokenB.address,
          dummyTokenBName,
          dummyTokenBSymbol,
          url,
          numDecimals,
          ipfsHash,
          swarmHash),
        tokenRegistry.addToken(
          DummyEtherToken.address,
          dummyEtherTokenName,
          dummyEtherTokenSymbol,
          url,
          dummyEtherTokenDecimals,
          ipfsHash,
          swarmHash,
        ),
      ]);
    });
  }
};
