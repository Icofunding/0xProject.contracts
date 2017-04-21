const ethUtil = require('ethereumjs-util');
const promisify = require('es6-promisify');
const crypto = require('./crypto');
const factory = require('./factory');

module.exports = web3 => {
  const index = {
    createOrder: async (params, { hashPersonal = true } = {}) => {
      const orderHash = crypto.getOrderHash(params);
      const toSign = hashPersonal ? ethUtil.hashPersonalMessage(orderHash) : orderHash;
      const sig = await promisify(web3.eth.sign)(params.maker, ethUtil.bufferToHex(toSign));
      const { v, r, s } = ethUtil.fromRpcSig(sig);
      const { maker, taker, feeRecipient, tokenM, tokenT, valueM, valueT, feeM, feeT, expiration } = params;
      const order = {
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
      };
      return order;
    },
    createOrderFactory: factory.createOrderFactory,
    getBalancesFactory: factory.getBalancesFactory,
  };
  return index;
};
