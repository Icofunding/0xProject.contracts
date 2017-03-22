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

exports.validSignature = (order, { hashPersonal = true } = {}) => {
  let orderHash;
  if (!order.orderHash) {
    orderHash = getOrderHash(order);
  } else {
    orderHash = ethUtil.toBuffer(order.orderHash);
  }
  const signed = hashPersonal ? ethUtil.hashPersonalMessage(orderHash) : orderHash;
  const { v, r, s } = order;
  try {
    const pubKey = ethUtil.ecrecover(signed, v, ethUtil.toBuffer(r), ethUtil.toBuffer(s));
    return ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey, true)) === order.maker;
  } catch (err) {
    return false;
  }
};
