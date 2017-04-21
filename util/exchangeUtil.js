const { createFill, createCancel, createBatchFill, createFillUpTo, createBatchCancel } = require('./formatters.js');

module.exports = exchange => {
  const exchangeUtil = {
    fill: (order, { fillValueM, shouldCheckTransfer = false, from }) => {
      const params = createFill(order, shouldCheckTransfer, fillValueM);
      return exchange.fill(
        params.traders,
        params.tokens,
        params.feeRecipient,
        params.shouldCheckTransfer,
        params.values,
        params.fees,
        params.expiration,
        params.fillValueM,
        params.v,
        params.rs,
        { from }
      );
    },
    cancel: (order, { cancelValueM, from }) => {
      const params = createCancel(order, cancelValueM);
      return exchange.cancel(
        params.traders,
        params.tokens,
        params.feeRecipient,
        params.values,
        params.fees,
        params.expiration,
        params.cancelValueM,
        { from }
      );
    },
    fillOrKill: (order, { fillValueM, from }) => {
      const params = createFill(order, null, fillValueM);
      return exchange.fillOrKill(
        params.traders,
        params.tokens,
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
    batchFill: (orders, { fillValuesM, shouldCheckTransfer = false, from }) => {
      const params = createBatchFill(orders, shouldCheckTransfer, fillValuesM);
      return exchange.batchFill(
        params.traders,
        params.tokens,
        params.feeRecipients,
        params.shouldCheckTransfer,
        params.values,
        params.fees,
        params.expirations,
        params.fillValuesM,
        params.v,
        params.rs,
        { from }
      );
    },
    batchFillOrKill: (orders, { fillValuesM, from }) => {
      const params = createBatchFill(orders, null, fillValuesM);
      return exchange.batchFillOrKill(
        params.traders,
        params.tokens,
        params.feeRecipients,
        params.values,
        params.fees,
        params.expirations,
        params.fillValuesM,
        params.v,
        params.rs,
        { from }
      );
    },
    fillUpTo: (orders, { fillValueM, shouldCheckTransfer = false, from }) => {
      const params = createFillUpTo(orders, shouldCheckTransfer, fillValueM);
      return exchange.fillUpTo(
        params.traders,
        params.tokens,
        params.feeRecipients,
        params.shouldCheckTransfer,
        params.values,
        params.fees,
        params.expirations,
        params.fillValueM,
        params.v,
        params.rs,
        { from }
      );
    },
    batchCancel: (orders, { cancelValuesM, from }) => {
      const params = createBatchCancel(orders, cancelValuesM);
      return exchange.batchCancel(
        params.traders,
        params.tokens,
        params.feeRecipients,
        params.values,
        params.fees,
        params.expirations,
        params.cancelValuesM,
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
    isValidSignature: order => {
      const isValidSignature = exchange.isValidSignature(
        order.maker,
        order.orderHashHex,
        order.v,
        order.r,
        order.s
      );
      return isValidSignature;
    },
  };
  return exchangeUtil;
};
