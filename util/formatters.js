const formatters = {
  createBatchFill(orders, shouldCheckTransfer, fillValuesM = []) {
    const ret = {
      traders: [],
      tokens: [],
      feeRecipients: [],
      shouldCheckTransfer,
      values: [],
      fees: [],
      expirations: [],
      fillValuesM,
      v: [],
      rs: [],
    };
    orders.forEach(order => {
      ret.traders.push([order.params.maker, order.params.taker]);
      ret.tokens.push([order.params.tokenM, order.params.tokenT]);
      ret.feeRecipients.push(order.params.feeRecipient);
      ret.values.push([order.params.valueM, order.params.valueT]);
      ret.fees.push([order.params.feeM, order.params.feeT]);
      ret.expirations.push(order.params.expiration);
      ret.v.push(order.params.v);
      ret.rs.push([order.params.r, order.params.s]);
      if (fillValuesM.length < orders.length) {
        ret.fillValuesM.push(order.params.valueM);
      }
    });
    return ret;
  },
  createFillUpTo(orders, shouldCheckTransfer, fillValueM) {
    const ret = {
      traders: [],
      tokens: [],
      feeRecipients: [],
      shouldCheckTransfer,
      values: [],
      fees: [],
      expirations: [],
      fillValueM,
      v: [],
      rs: [],
    };
    orders.forEach(order => {
      ret.traders.push([order.params.maker, order.params.taker]);
      ret.tokens.push([order.params.tokenM, order.params.tokenT]);
      ret.feeRecipients.push(order.params.feeRecipient);
      ret.values.push([order.params.valueM, order.params.valueT]);
      ret.fees.push([order.params.feeM, order.params.feeT]);
      ret.expirations.push(order.params.expiration);
      ret.v.push(order.params.v);
      ret.rs.push([order.params.r, order.params.s]);
    });
    return ret;
  },
  createBatchCancel(orders, cancelValuesM = []) {
    const ret = {
      traders: [],
      tokens: [],
      feeRecipients: [],
      values: [],
      fees: [],
      expirations: [],
      cancelValuesM,
    };
    orders.forEach(order => {
      ret.traders.push([order.params.maker, order.params.taker]);
      ret.tokens.push([order.params.tokenM, order.params.tokenT]);
      ret.feeRecipients.push(order.params.feeRecipient);
      ret.values.push([order.params.valueM, order.params.valueT]);
      ret.fees.push([order.params.feeM, order.params.feeT]);
      ret.expirations.push(order.params.expiration);
      if (cancelValuesM.length < orders.length) {
        ret.cancelValuesM.push(order.params.valueM);
      }
    });
    return ret;
  },
};

module.exports = formatters;
