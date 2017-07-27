import { ContractInstance } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  TokenTransferProxy,
  Exchange,
  TokenRegistry,
} = new Artifacts(artifacts);

let tokenTransferProxy: ContractInstance;
module.exports = (deployer: any) => {
  deployer.then(() => {
    return Promise.all([
      TokenTransferProxy.deployed(),
      TokenRegistry.deployed(),
    ]);
  })
  .then((instances: ContractInstance[]) => {
    let tokenRegistry: ContractInstance;
    [tokenTransferProxy, tokenRegistry] = instances;
    return tokenRegistry.getTokenAddressBySymbol('ZRX');
  })
  .then((ptAddress: string) => {
    return deployer.deploy(Exchange, ptAddress, tokenTransferProxy.address);
  }).then(() => {
    return tokenTransferProxy.addAuthorizedAddress(Exchange.address);
  });
};
