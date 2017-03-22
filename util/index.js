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
        const orderHash = getOrderHash(params, { hex: true, hashPersonal });
        web3.eth.sign(params.maker, orderHash, (err, sig) => {
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
      let orderHash;
      if (!order.orderHash) {
        orderHash = getOrderHash(order, { hashPersonal });
      } else {
        orderHash = ethUtil.toBuffer(order.orderHash);
      }
      const { v, r, s } = order;
      try {
        const pubKey = ethUtil.ecrecover(orderHash, v, ethUtil.toBuffer(r), ethUtil.toBuffer(s));
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
