import { ContractInstance } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  Proxy,
  MultiSigWallet,
  TokenRegistry,
} = new Artifacts(artifacts);

let tokenRegistry: ContractInstance;
module.exports = (deployer: any, network: string) => {
  if (network !== 'development') {
    deployer.then(() => {
      Promise.all([
        Proxy.deployed(),
        TokenRegistry.deployed(),
      ]).then((instances: ContractInstance[]) => {
        let proxy: ContractInstance;
        [proxy, tokenRegistry] = instances;
        return proxy.transferOwnership(MultiSigWallet.address);
      }).then(() => {
        return tokenRegistry.transferOwnership(MultiSigWallet.address);
      });
    });
  }
};
