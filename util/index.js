const ethUtil = require('ethereumjs-util');
const { getOrderHash } = require('./hashUtil.js');
const BNutil = require('./BNutil.js');
const exchangeUtil = require('./exchangeUtil.js');
const exchangeWUtil = require('./exchangeWUtil.js');
const multiSigUtil = require('./multiSigUtil.js');
const testUtil = require('./testUtil.js');

module.exports = web3 => {
  const index = {
    createOrder: (params, { hashPersonal = true } = {}) => {
      const order = new Promise((resolve, reject) => {
        const orderHashBuff = getOrderHash(params);
        const toSign = hashPersonal ? ethUtil.hashPersonalMessage(orderHashBuff) : orderHashBuff;
        web3.eth.sign(params.maker, ethUtil.bufferToHex(toSign), (err, sig) => {
          if (err) {
            reject(err);
          }
          const { v, r, s } = ethUtil.fromRpcSig(sig);
          const { maker, taker, feeRecipient, tokenM, tokenT, valueM, valueT, feeM, feeT, expiration } = params;
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
            orderHash: ethUtil.bufferToHex(orderHashBuff),
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
    },
    createOrderFactory: testUtil.createOrderFactory,
    getBalancesFactory: testUtil.getBalancesFactory,
    sha3: ethUtil.sha3,
    getOrderHash,
    BNutil,
    exchangeUtil,
    exchangeWUtil,
    multiSigUtil,
  };
  return index;
};
