const ethUtil = require('ethereumjs-util');
const ABI = require('ethereumjs-abi');

module.exports = multiSig => {
  const encodeFnArgs = ({ name, abi, args = [] }) => {
    let types;
    let funcSig;
    let argsData;
    for (let i = 0; i < abi.length; i += 1) {
      if (abi[i].name === name) {
        types = abi[i].inputs.map(input => input.type);
        funcSig = ethUtil.bufferToHex(ABI.methodID(name, types));
        argsData = args.map(arg => {
          const target = typeof arg === 'boolean' ? +arg : arg;
          const targetBuff = ethUtil.toBuffer(target);
          return ethUtil.setLengthLeft(targetBuff, 32).toString('hex');
        });
        break;
      }
    }
    return funcSig + argsData.join('');
  };

  const submitTransaction = ({ destination, value = 0, data, from, dataParams }) => {
    const encoded = data || encodeFnArgs(dataParams);
    return multiSig.submitTransaction(destination, value, encoded, { from });
  };

  return {
    encodeFnArgs,
    submitTransaction,
  };
};
