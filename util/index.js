const ethUtil = require('ethereumjs-util');
const { getOrderHash, validSignature } = require('./crypto.js');
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
    createOrderFactory: testUtil.createOrderFactory,
    getBalancesFactory: testUtil.getBalancesFactory,
    sha3: ethUtil.sha3,
    validSignature,
    getOrderHash,
    BNutil,
    exchangeUtil,
    exchangeWUtil,
    multiSigUtil,
  };
  return index;
};
