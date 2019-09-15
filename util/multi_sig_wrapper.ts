import * as _ from 'lodash';
import * as Web3 from 'web3';
import {TransactionDataParams, ContractInstance} from './types';
import ethUtil = require('ethereumjs-util');
import ABI = require('ethereumjs-abi');

export class MultiSigWrapper {
  private multiSig: ContractInstance;
  constructor(multiSigContractInstance: ContractInstance) {
    this.multiSig = multiSigContractInstance;
  }
  public async submitTransactionAsync(destination: string, from: string,
                                      dataParams: TransactionDataParams,
                                      value: number = 0) {
    const {name, abi, args = []} = dataParams;
    const encoded = this.encodeFnArgs(name, abi, args);
    return this.multiSig.submitTransaction(destination, value, encoded, {from});
  }
  public encodeFnArgs(name: string, abi: Web3.AbiDefinition[], args: any[]) {
    const abiEntity = _.find(abi, {name}) as Web3.MethodAbi;
    if (_.isUndefined(abiEntity)) {
      throw new Error(`Did not find abi entry for name: ${name}`);
    }
    const types = _.map(abiEntity.inputs, input => input.type);
    const funcSig = ethUtil.bufferToHex(ABI.methodID(name, types));
    const argsData = _.map(args, arg => {
      const target = _.isBoolean(arg) ? +arg : arg;
      const targetBuff = ethUtil.toBuffer(target);
      return ethUtil.setLengthLeft(targetBuff, 32).toString('hex');
    });
    return funcSig + argsData.join('');
  }
}
