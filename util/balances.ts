import * as _ from 'lodash';
import * as BigNumber from 'bignumber.js';
import { BalancesByOwner, ContractInstance } from './types';

export class Balances {
  private tokenContractInstances: ContractInstance[];
  private ownerAddresses: string[];
  constructor(tokenContractInstances: ContractInstance[], ownerAddresses: string[]) {
    this.tokenContractInstances = tokenContractInstances;
    this.ownerAddresses = ownerAddresses;
  }
  public async getAsync(): Promise<BalancesByOwner> {
    const balancesByOwner: BalancesByOwner = {};
    for (const tokenContractInstance of this.tokenContractInstances) {
      for (const ownerAddress of this.ownerAddresses) {
        const balance = await tokenContractInstance.balanceOf(ownerAddress);
        if (_.isUndefined(balancesByOwner[ownerAddress])) {
          balancesByOwner[ownerAddress] = {};
        }
        balancesByOwner[ownerAddress][tokenContractInstance.address] = balance.toString();
      }
    }
    return balancesByOwner;
  }
}
