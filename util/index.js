const ethUtil = require('ethereumjs-util');
const { getOrderHash, isValidSignature } = require('./crypto.js');
const BNutil = require('./BNutil.js');
const exchangeUtil = require('./exchangeUtil.js');
const multiSigUtil = require('./multiSigUtil.js');
const testUtil = require('./testUtil.js');

module.exports = web3 => {
  const index = {
    createOrder: (params, { hashPersonal = true } = {}) => {
      const order = new Promise((resolve, reject) => {
        const orderHash = getOrderHash(params);
        const toSign = hashPersonal ? ethUtil.hashPersonalMessage(orderHash) : orderHash;
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
    createOrderFactory: testUtil.createOrderFactory,
    getBalancesFactory: testUtil.getBalancesFactory,
    sha3: ethUtil.sha3,
    isValidSignature,
    getOrderHash,
    BNutil,
    exchangeUtil,
    multiSigUtil,
  };
  return index;
};
