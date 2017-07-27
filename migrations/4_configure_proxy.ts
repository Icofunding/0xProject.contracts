import { ContractInstance } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  TokenProxy,
  Exchange,
  TokenRegistry,
} = new Artifacts(artifacts);

let tokenProxy: ContractInstance;
module.exports = (deployer: any) => {
  deployer.then(() => {
    return Promise.all([
      TokenProxy.deployed(),
      TokenRegistry.deployed(),
    ]);
  })
  .then((instances: ContractInstance[]) => {
    let tokenRegistry: ContractInstance;
    [tokenProxy, tokenRegistry] = instances;
    return tokenRegistry.getTokenAddressBySymbol('ZRX');
  })
  .then((ptAddress: string) => {
    return deployer.deploy(Exchange, ptAddress, tokenProxy.address);
  }).then(() => {
    return tokenProxy.addAuthorizedAddress(Exchange.address);
  });
};
