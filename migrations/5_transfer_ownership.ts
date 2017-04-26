import { ContractInstance } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  Proxy,
  MultiSigWallet,
  TokenRegistry,
} = new Artifacts(artifacts);

module.exports = (deployer: any, network: string) => {
  if (network !== 'development') {
    deployer.then(() => {
      Promise.all([
        Proxy.deployed(),
        TokenRegistry.deployed(),
      ]).then((instances: ContractInstance[]) => {
        const [proxy, tokenRegistry] = instances;
        return Promise.all([
          proxy.transferOwnership(MultiSigWallet.address),
          tokenRegistry.transferOwnership(MultiSigWallet.address),
        ]);
      });
    });
  }
};
