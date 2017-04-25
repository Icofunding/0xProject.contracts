import { Artifacts } from '../util/artifacts';
const {
  Proxy,
  MultiSigWallet,
  TokenRegistry,
} = new Artifacts(artifacts);

module.exports = (deployer: any, network: string, accounts: string[]) => {
  if (network !== 'development') {
    Promise.all([
      Proxy.deployed(),
      TokenRegistry.deployed(),
    ]).then(instances => {
      const [proxy, tokenReg] = instances;
      return Promise.all([
        proxy.transferOwnership(MultiSigWallet.address, { from: accounts[0] }),
        tokenReg.transferOwnership(MultiSigWallet.address, { from: accounts[0] }),
      ]);
    });
  }
};
