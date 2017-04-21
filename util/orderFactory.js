const ethUtil = require('ethereumjs-util');
const promisify = require('es6-promisify');
const crypto = require('./crypto');

class OrderFactory {
  constructor(defaultOrderParams) {
    this.defaultOrderParams = defaultOrderParams;
  }
  async generateSignedOrderAsync(customOrderParams = {}, { hashPersonal = true } = {}) {
    const randomExpiration = Math.floor((Date.now() + (Math.random() * 100000000000)) / 1000);
    const orderParams = Object.assign({}, {
      expiration: randomExpiration,
      taker: '0x0',
    }, this.defaultOrderParams, customOrderParams);
    const orderHash = crypto.getOrderHash(orderParams);
    const toSign = hashPersonal ? ethUtil.hashPersonalMessage(orderHash) : orderHash;
    const sig = await promisify(web3.eth.sign)(orderParams.maker, ethUtil.bufferToHex(toSign));
    const { v, r, s } = ethUtil.fromRpcSig(sig);
    const { maker, taker, feeRecipient, tokenM, tokenT, valueM, valueT, feeM, feeT, expiration } = orderParams;
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
      orderHashHex: ethUtil.bufferToHex(orderHash),
      expiration,
      v,
      r: ethUtil.bufferToHex(r),
      s: ethUtil.bufferToHex(s),
    };
    return order;
  }
}

module.exports = OrderFactory;
