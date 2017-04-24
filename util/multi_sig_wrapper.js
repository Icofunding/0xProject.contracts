const _ = require('lodash');
const ethUtil = require('ethereumjs-util');
const ABI = require('ethereumjs-abi');

class MultiSigWrapper {
  constructor(multiSigContractInstance) {
    this._multiSig = multiSigContractInstance;
  }
  async submitTransactionAsync(destination, from, dataParams, value = 0) {
    const { name, abi, args = [] } = dataParams;
    const encoded = this._encodeFnArgs(name, abi, args);
    return this._multiSig.submitTransaction(destination, value, encoded, { from });
  }
  _encodeFnArgs(name, abi, args) {
    const abiEntity = _.find(abi, { name });
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

module.exports = MultiSigWrapper;
