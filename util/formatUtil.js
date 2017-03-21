exports.createFill = (order, caller, fillValueM) => {
  const fill = {
    traders: [order.maker, order.taker],
    caller,
    feeRecipient: order.feeRecipient,
    tokens: [order.tokenM, order.tokenT],
    values: [order.valueM, order.valueT],
    fees: [order.feeM, order.feeT],
    expiration: order.expiration,
    fillValueM,
    v: order.v,
    rs: [order.r, order.s],
  };
  return fill;
};

exports.createBatchFill = (orders, fillValuesM) => {
  const ret = {
    traders: [],
    feeRecipients: [],
    tokens: [],
    values: [],
    fees: [],
    expirations: [],
    fillValuesM,
    v: [],
    rs: [],
  };
  orders.forEach(order => {
    ret.traders.push([order.maker, order.taker]);
    ret.feeRecipients.push(order.feeRecipient);
    ret.tokens.push([order.tokenM, order.tokenT]);
    ret.values.push([order.valueM, order.valueT]);
    ret.fees.push([order.feeM, order.feeT]);
    ret.expirations.push(order.expiration);
    ret.v.push(order.v);
    ret.rs.push([order.r, order.s]);
  });
  return ret;
};

exports.createFillUpTo = (orders, fillValueM) => {
  const ret = {
    traders: [],
    feeRecipients: [],
    tokens: [],
    values: [],
    fees: [],
    expirations: [],
    fillValueM,
    v: [],
    rs: [],
  };
  orders.forEach(order => {
    ret.traders.push([order.maker, order.taker]);
    ret.feeRecipients.push(order.feeRecipient);
    ret.tokens.push([order.tokenM, order.tokenT]);
    ret.values.push([order.valueM, order.valueT]);
    ret.fees.push([order.feeM, order.feeT]);
    ret.expirations.push(order.expiration);
    ret.v.push(order.v);
    ret.rs.push([order.r, order.s]);
  });
  return ret;
};

exports.createCancel = (order, caller, cancelValueM) => {
  const cancel = {
    traders: [order.maker, order.taker],
    caller,
    tokens: [order.tokenM, order.tokenT],
    values: [order.valueM, order.valueT],
    fees: [order.feeM, order.feeT],
    expiration: order.expiration,
    cancelValueM,
  };
  return cancel;
};

exports.createBatchCancel = (orders, cancelValuesM) => {
  const ret = {
    traders: [],
    tokens: [],
    values: [],
    expirations: [],
    cancelValuesM,
  };
  orders.forEach(order => {
    ret.traders.push([order.maker, order.taker]);
    ret.tokens.push([order.tokenM, order.tokenT]);
    ret.values.push([order.valueM, order.valueT]);
    ret.expirations.push(order.expiration);
  });
  return ret;
};
