import * as _ from 'lodash';
import * as Bluebird from 'bluebird';
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
  deployer.then(() => {
    return TokenRegistry.deployed();
  })
  .then((instance: ContractInstance) => {
    tokenRegistry = instance;
    return Bluebird.each([
      tokenRegistry.getTokenAddressBySymbol('ZRX'),
      tokenRegistry.getTokenAddressBySymbol('WETH'),
    ], _.noop);
  })
  .then((tokenAddresses: string[]) => {
    const [zrxAddress, wEthAddress] = tokenAddresses;
    return deployer.deploy(SimpleCrowdsale, Exchange.address, Proxy.address, zrxAddress, wEthAddress);
  });
};
