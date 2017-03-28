exports.createFill = (order, shouldCheckTransfer, fillValueM) => {
  const fill = {
    traders: [order.maker, order.taker],
    tokens: [order.tokenM, order.tokenT],
    feeRecipient: order.feeRecipient,
    shouldCheckTransfer,
    values: [order.valueM, order.valueT],
    fees: [order.feeM, order.feeT],
    expiration: order.expiration,
    fillValueM: fillValueM || order.valueM,
    v: order.v,
    rs: [order.r, order.s],
  };
  return fill;
};

exports.createBatchFill = (orders, shouldCheckTransfer, fillValuesM = []) => {
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
    ret.traders.push([order.maker, order.taker]);
    ret.tokens.push([order.tokenM, order.tokenT]);
    ret.feeRecipients.push(order.feeRecipient);
    ret.values.push([order.valueM, order.valueT]);
    ret.fees.push([order.feeM, order.feeT]);
    ret.expirations.push(order.expiration);
    ret.v.push(order.v);
    ret.rs.push([order.r, order.s]);
    if (fillValuesM.length < orders.length) {
      ret.fillValuesM.push(order.valueM);
    }
  });
  return ret;
};

exports.createFillUpTo = (orders, shouldCheckTransfer, fillValueM) => {
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
    ret.traders.push([order.maker, order.taker]);
    ret.tokens.push([order.tokenM, order.tokenT]);
    ret.feeRecipients.push(order.feeRecipient);
    ret.values.push([order.valueM, order.valueT]);
    ret.fees.push([order.feeM, order.feeT]);
    ret.expirations.push(order.expiration);
    ret.v.push(order.v);
    ret.rs.push([order.r, order.s]);
  });
  return ret;
};

exports.createCancel = (order, cancelValueM) => {
  const cancel = {
    traders: [order.maker, order.taker],
    tokens: [order.tokenM, order.tokenT],
    feeRecipient: order.feeRecipient,
    values: [order.valueM, order.valueT],
    fees: [order.feeM, order.feeT],
    expiration: order.expiration,
    cancelValueM: cancelValueM || order.valueM,
  };
  return cancel;
};

exports.createBatchCancel = (orders, cancelValuesM = []) => {
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
    ret.traders.push([order.maker, order.taker]);
    ret.tokens.push([order.tokenM, order.tokenT]);
    ret.feeRecipients.push(order.feeRecipient);
    ret.values.push([order.valueM, order.valueT]);
    ret.fees.push([order.feeM, order.feeT]);
    ret.expirations.push(order.expiration);
    if (cancelValuesM.length < orders.length) {
      ret.cancelValuesM.push(order.valueM);
    }
  });
  return ret;
};
