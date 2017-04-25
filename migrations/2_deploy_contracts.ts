import { MultiSigConfigByNetwork, ContractInstance } from '../util/types';
import { Artifacts } from '../util/artifacts';
const {
  MultiSigWallet,
  Proxy,
  Exchange,
  ProtocolToken,
  DummyProtocolToken,
  TokenRegistry,
} = new Artifacts(artifacts);

let multiSigConfigByNetwork: MultiSigConfigByNetwork;
try {
  /* tslint:disable */
  multiSigConfigByNetwork = require('./multisig_config');
  /* tslint:enable */
} catch (e) {
  multiSigConfigByNetwork = {};
}

module.exports = (deployer: any, network: string, accounts: string[]) => {
  const defaultConfig = {
    owners: [accounts[0], accounts[1]],
    confirmationsRequired: 2,
    secondsRequired: 0,
  };
  const config = multiSigConfigByNetwork[network] || defaultConfig;
  if (network === 'development') {
    deployer.deploy([
      [MultiSigWallet, config.owners, config.confirmationsRequired, config.secondsRequired],
      Proxy,
      [DummyProtocolToken, 0],
      TokenRegistry,
    ])
    .then(() => deployer.deploy(Exchange, DummyProtocolToken.address, Proxy.address))
    .then(() => Proxy.deployed())
    .then((proxy: ContractInstance) => proxy.addAuthorizedAddress(Exchange.address, { from: accounts[0] }));
  } else {
    deployer.deploy([
      [MultiSigWallet, config.owners, config.confirmationsRequired, config.secondsRequired],
      Proxy,
      ProtocolToken,
      TokenRegistry,
    ])
    .then(() => deployer.deploy(Exchange, ProtocolToken.address, Proxy.address))
    .then(() => Proxy.deployed())
    .then((proxy: ContractInstance) => proxy.addAuthorizedAddress(Exchange.address, { from: accounts[0] }));
  }
};
