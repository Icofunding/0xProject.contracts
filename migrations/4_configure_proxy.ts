import { ContractInstance } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  Proxy,
  Exchange,
  TokenRegistry,
} = new Artifacts(artifacts);

let proxy: ContractInstance;
module.exports = (deployer: any) => {
  console.log('Number 4!');
  deployer.then(() => {
    return Promise.all([
      Proxy.deployed(),
      TokenRegistry.deployed(),
    ]);
  })
  .then((instances: ContractInstance[]) => {
    let tokenRegistry: ContractInstance;
    [proxy, tokenRegistry] = instances;
    return tokenRegistry.getTokenAddressBySymbol('ZRX');
  })
  .then((ptAddress: string) => {
    console.log('ptAddress', ptAddress);
    return deployer.deploy(Exchange, ptAddress, proxy.address);
  }).then(() => {
    return proxy.addAuthorizedAddress(Exchange.address);
  });
};
