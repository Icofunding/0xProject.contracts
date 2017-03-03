const ethUtil = require('ethereumjs-util');
const BNutils = require('./BNutils.js');

exports.solSHA3 = (...args) => {
  return ethUtil.sha3(Buffer.concat(args.map(arg => {
    if (typeof arg === 'number') {
      return BNutils.toBuffer(arg);
    }
    return ethUtil.toBuffer(arg);
  })));
}

exports.getOrderHash = (params, { hex = false } = {}) => {
  let orderHash;
  if (params.taker !== '0x0') {
    orderHash = exports.solSHA3(
      params.exchange,
      params.maker,
      params.taker,
      params.tokenM,
      params.tokenT,
      params.valueM,
      params.valueT,
      params.expiration
    );
  } else {
    orderHash = exports.solSHA3(
      params.exchange,
      params.maker,
      params.tokenM,
      params.tokenT,
      params.valueM,
      params.valueT,
      params.expiration
    );
  }
  return hex ? ethUtil.bufferToHex(orderHash) : orderHash;
};

exports.getMsgHash = (params, { hex = false, hashPersonal = false } = {}) => {
  let msgHash = exports.solSHA3(
    params.orderHash,
    params.feeRecipient,
    params.feeM,
    params.feeT
  );
  if (hashPersonal) {
    msgHash = ethUtil.hashPersonalMessage(msgHash);
  }
  return hex ? msgHash = ethUtil.bufferToHex(msgHash) : msgHash;
};
