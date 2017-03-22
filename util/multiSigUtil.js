const ethUtil = require('ethereumjs-util');
const ABI = require('ethereumjs-abi');

module.exports = multiSig => {
  const encodeFnArgs = ({ name, abi, args = [] }) => {
    let types;
    let funcSig;
    let argsData;
    for (let i = 0; i < abi.length; i++) {
      if (abi[i].name === name) {
        types = abi[i].inputs.map(input => input.type);
        funcSig = ethUtil.bufferToHex(ABI.methodID(name, types));
        argsData = args.map((arg, j) => {
          if (typeof arg === 'boolean') {
            return ethUtil.setLengthLeft(ethUtil.toBuffer(+arg), 32).toString('hex');
          }
          return ethUtil.setLengthLeft(ethUtil.toBuffer(arg), 32).toString('hex');
        });
        break;
      }
    }
    return funcSig + argsData.join('');
  };

  const submitTransaction = ({ destination, value = 0, data, from, dataParams }) => {
    data = data || encodeFnArgs(dataParams);
    return multiSig.submitTransaction(destination, value, data, { from });
  };

  const confirmTransaction = ({ transactionId, from }) => {
    return multiSig.confirmTransaction(transactionId, { from });
  }

  return {
    encodeFnArgs,
    submitTransaction,
    confirmTransaction
  };
};
