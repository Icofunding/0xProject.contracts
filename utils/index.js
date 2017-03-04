const ethUtil = require('ethereumjs-util');
const { getOrderHash, getMsgHash } = require('./hashUtils.js');
const BNutils = require('./BNutils.js');

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
    sha3: ethUtil.sha3,
    getOrderHash,
    getMsgHash,
    BNutils
  };
};
