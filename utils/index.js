const ethUtil = require('ethereumjs-util');
const BN = require('bn.js');

const solSHA3 = (...args) => {
  return ethUtil.sha3(Buffer.concat(args.map(arg => {
    if (typeof arg === 'number') {
      return new BN(arg).toArrayLike(Buffer, 'be', 256 / 8);
    }
    return ethUtil.toBuffer(arg);
  })));
}

const getOrderHash = (params, { hex = false } = {}) => {
  let orderHash;
  if (params.taker !== '0x0') {
    orderHash = solSHA3(
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
    orderHash = solSHA3(
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

const getMsgHash = (params, { hex = false, hashPersonal = false } = {}) => {
  let msgHash = solSHA3(
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

module.exports = (web3) => {
  return {
    createOrder: (params) => {
      return new Promise((resolve, reject) => {
        params.orderHash = getOrderHash(params, { hex: true });
        let msgHash = getMsgHash(params, { hex: true, hashPersonal: true });
        web3.eth.sign(params.maker, msgHash, (err, sig) => {
          if (err) {
            reject(err);
          }
          let { v, r, s } = ethUtil.fromRpcSig(sig);
          let { maker, feeRecipient, tokenM, tokenT, valueM, valueT, feeM, feeT, expiration, orderHash } = params;
          resolve({
            maker,
            feeRecipient,
            tokenM,
            tokenT,
            valueM,
            valueT,
            feeM,
            feeT,
            orderHash,
            expiration,
            v,
            r: ethUtil.bufferToHex(r),
            s: ethUtil.bufferToHex(s)
          });
        });
      });
    },
    validSignature: (order, { hashPersonal = true } = {}) => {
      let msgHash = getMsgHash(order, { hashPersonal });
      let { v, r, s } = order;
      try {
        let pubKey = ethUtil.ecrecover(msgHash, v, ethUtil.toBuffer(r), ethUtil.toBuffer(s));
        return ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey, true)) === order.maker;
      }
      catch(err) {
        return false;
      }
    },
    getMsgHash,
    solSHA3
  };
};
