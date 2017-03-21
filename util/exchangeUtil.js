const { createFill, createCancel } = require('./formatUtil.js');
const { getMsgHash } = require('./hashUtil.js');

module.exports = exchange => {
  const exchangeUtil = {
    fill: (order, { fillValueM, from, caller }) => {
      const params = createFill(order, caller || from, fillValueM);
      return exchange.fill(
        params.traders,
        params.caller,
        params.feeRecipient,
        params.tokens,
        params.values,
        params.fees,
        params.expiration,
        params.fillValueM,
        params.v,
        params.rs,
        { from }
      );
    },
    cancel: (order, { cancelValueM, from, caller }) => {
      const params = createCancel(order, caller || from, cancelValueM);
      return exchange.cancel(
        params.traders,
        params.caller,
        params.tokens,
        params.values,
        params.expiration,
        params.cancelValueM,
        { from }
      );
    },
    getOrderHash: order => {
      const params = createFill(order);
      return exchange.getOrderHash(
        params.traders,
        params.tokens,
        params.values,
        params.expiration
      );
    },
    getMsgHash: order => {
      const msgHash = exchange.getMsgHash(
        order.orderHash,
        order.feeRecipient,
        [order.feeM, order.feeT]
      );
      return msgHash;
    },
    validSignature: order => {
      const validSignature = exchange.validSignature(
        order.maker,
        getMsgHash(order, { hex: true }),
        order.v,
        order.r,
        order.s
      );
      return validSignature;
    },
  };
  return exchangeUtil;
};
