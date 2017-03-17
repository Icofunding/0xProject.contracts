exports.createOrderFactory = defaultParams => {
  const orderFactory = params => Object.assign(
    {},
    {
      expiration: Math.floor((Date.now() + (Math.random() * 1000000)) / 1000),
      taker: '0x0',
    },
    defaultParams,
    params
  );
  return orderFactory;
};
