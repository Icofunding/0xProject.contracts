const ethUtil = require('ethereumjs-util');
const BNUtils = require('./BNUtil.js');

exports.solSHA3 = (...args) => {
  const solSha3 = ethUtil.sha3(Buffer.concat(args.map(arg => {
    if (!ethUtil.isHexString(arg) && !isNaN(+arg)) {
      return BNUtils.toBuffer(arg);
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

exports.isValidSignature = order => {
  const orderHash = order.orderHash ? order.orderHash : getOrderHash(order);
  const prefixedHash = ethUtil.hashPersonalMessage(orderHash);
  const { v, r, s } = order;
  try {
    const pubKey = ethUtil.ecrecover(prefixedHash, v, ethUtil.toBuffer(r), ethUtil.toBuffer(s));
    return ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey)) === order.maker;
  } catch (err) {
    return false;
  }
};
