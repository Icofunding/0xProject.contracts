const { createBatchFill, createFillUpTo, createBatchCancel } = require('./formatters.js');

class ExchangeWrapper {
  constructor(exchangeContractInstance) {
    this._exchange = exchangeContractInstance;
  }
  fill(order, { fillValueM, shouldCheckTransfer = false, from }) {
    const params = order.createFill(shouldCheckTransfer, fillValueM);
    return this._exchange.fill(
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
  }
  cancel(order, { cancelValueM, from }) {
    const params = order.createCancel(cancelValueM);
    return this._exchange.cancel(
      params.traders,
      params.tokens,
      params.feeRecipient,
      params.values,
      params.fees,
      params.expiration,
      params.cancelValueM,
      { from }
    );
  }
  fillOrKill(order, { fillValueM, from }) {
    const params = order.createFill(null, fillValueM);
    return this._exchange.fillOrKill(
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
  }
  batchFill(orders, { fillValuesM, shouldCheckTransfer = false, from }) {
    const params = createBatchFill(orders, shouldCheckTransfer, fillValuesM);
    return this._exchange.batchFill(
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
  }
  batchFillOrKill(orders, { fillValuesM, from }) {
    const params = createBatchFill(orders, null, fillValuesM);
    return this._exchange.batchFillOrKill(
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
  }
  fillUpTo(orders, { fillValueM, shouldCheckTransfer = false, from }) {
    const params = createFillUpTo(orders, shouldCheckTransfer, fillValueM);
    return this._exchange.fillUpTo(
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
  }
  batchCancel(orders, { cancelValuesM, from }) {
    const params = createBatchCancel(orders, cancelValuesM);
    return this._exchange.batchCancel(
      params.traders,
      params.tokens,
      params.feeRecipients,
      params.values,
      params.fees,
      params.expirations,
      params.cancelValuesM,
      { from }
    );
  }
  getOrderHash(order) {
    const params = order.createFill();
    return this._exchange.getOrderHash(
      params.traders,
      params.tokens,
      params.feeRecipient,
      params.values,
      params.fees,
      params.expiration
    );
  }
  isValidSignature(order) {
    const isValidSignature = this._exchange.isValidSignature(
      order.params.maker,
      order.params.orderHashHex,
      order.params.v,
      order.params.r,
      order.params.s
    );
    return isValidSignature;
  }
}

module.exports = ExchangeWrapper;
