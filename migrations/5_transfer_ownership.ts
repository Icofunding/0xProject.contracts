import { ContractInstance } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  TokenProxy,
  MultiSigWalletWithTimeLock,
  TokenRegistry,
} = new Artifacts(artifacts);

let tokenRegistry: ContractInstance;
module.exports = (deployer: any, network: string) => {
  if (network !== 'development') {
    deployer.then(() => {
      Promise.all([
        TokenProxy.deployed(),
        TokenRegistry.deployed(),
      ]).then((instances: ContractInstance[]) => {
        let tokenProxy: ContractInstance;
        [tokenProxy, tokenRegistry] = instances;
        return tokenProxy.transferOwnership(MultiSigWalletWithTimeLock.address);
      }).then(() => {
        return tokenRegistry.transferOwnership(MultiSigWalletWithTimeLock.address);
      });
    });
  }
};
