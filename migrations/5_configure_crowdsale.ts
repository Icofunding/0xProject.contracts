import { ContractInstance } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  Proxy,
  Exchange,
  TokenRegistry,
  SimpleCrowdsale,
} = new Artifacts(artifacts);

let tokenRegistry: ContractInstance;
module.exports = (deployer: any) => {
  deployer.then(() => TokenRegistry.deployed()
  .then((instance: ContractInstance) => {
    tokenRegistry = instance;
    return Promise.all([
      tokenRegistry.getTokenAddressBySymbol('ZRX'),
      tokenRegistry.getTokenAddressBySymbol('WETH'),
    ]);
  })
  .then((tokenAddresses: string[]) => {
    const [zrxAddress, wEthAddress] = tokenAddresses;
    return deployer.deploy(SimpleCrowdsale, Exchange.address, Proxy.address, zrxAddress, wEthAddress);
  }));
};
