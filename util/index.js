const ethUtil = require('ethereumjs-util');
const { getOrderHash, getMsgHash } = require('./hashUtil.js');
const BNutil = require('./BNutil.js');
const exchangeUtil = require('./exchangeUtil.js');
const testUtil = require('./testUtil.js');

module.exports = web3 => {
  const index = {
    createOrder: initialParams => {
      const params = initialParams;
      const order = new Promise((resolve, reject) => {
        params.orderHash = getOrderHash(params, { hex: true });
        const msgHash = getMsgHash(params, { hex: true, hashPersonal: true });
        web3.eth.sign(params.maker, msgHash, (err, sig) => {
          if (err) {
            reject(err);
          }
          const { v, r, s } = ethUtil.fromRpcSig(sig);
          const { maker, taker, feeRecipient, tokenM, tokenT, valueM, valueT, feeM, feeT, expiration, orderHash } = params;
          resolve({
            maker,
            taker,
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
            s: ethUtil.bufferToHex(s),
          });
        });
      });
      return order;
    },
    validSignature: (order, { hashPersonal = true } = {}) => {
      const msgHash = getMsgHash(order, { hashPersonal });
      const { v, r, s } = order;
      try {
        const pubKey = ethUtil.ecrecover(msgHash, v, ethUtil.toBuffer(r), ethUtil.toBuffer(s));
        return ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey, true)) === order.maker;
      } catch (err) {
        return false;
      }
    },
    createOrderFactory: testUtil.createOrderFactory,
    sha3: ethUtil.sha3,
    getOrderHash,
    getMsgHash,
    BNutil,
    exchangeUtil,
  };
  return index;
};
