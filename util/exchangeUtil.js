const { createFill, createCancel } = require('./formatters.js');

module.exports = exchange => {
  const exchangeUtil = {
    fill: (order, { fillValueM, from, caller }) => {
      const params = createFill(order, caller || from, fillValueM);
      return exchange.fill(
        params.traders,
        params.tokens,
        params.caller,
        params.feeRecipient,
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
        params.tokens,
        params.caller,
        params.feeRecipient,
        params.values,
        params.fees,
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
        params.feeRecipient,
        params.values,
        params.fees,
        params.expiration
      );
    },
    validSignature: order => {
      const validSignature = exchange.validSignature(
        order.maker,
        order.orderHash,
        order.v,
        order.r,
        order.s
      );
      return validSignature;
    },
  };
  return exchangeUtil;
};
