const ethUtil = require('ethereumjs-util');
const BNutils = require('./BNutil.js');

exports.solSHA3 = (...args) => {
  const solSha3 = ethUtil.sha3(Buffer.concat(args.map(arg => {
    if (!ethUtil.isHexString(arg) && !isNaN(+arg)) {
      return BNutils.toBuffer(arg);
    }
    if (arg === '0x0') { // TODO: create isEmptyAddress func
      return ethUtil.setLength(ethUtil.toBuffer(arg), 20);
    }
    return ethUtil.toBuffer(arg);
  })));
  return solSha3;
};

exports.getOrderHash = (params, { hex = false } = {}) => {
  const orderHash = exports.solSHA3(
      params.exchange,
      params.maker,
      params.taker,
      params.tokenM,
      params.tokenT,
      params.feeRecipient,
      params.valueM,
      params.valueT,
      params.feeM,
      params.feeT,
      params.expiration
    );
  return hex ? ethUtil.bufferToHex(orderHash) : orderHash;
};
