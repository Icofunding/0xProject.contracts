exports.createOrderFactory = defaultParams => {
  const orderFactory = (params = {}) => Object.assign(
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

exports.getBalancesFactory = (tokens, addresses) => {
  const pairs = [];
  tokens.forEach(token => {
    addresses.forEach(address => pairs.push([token, address]));
  });
  const getBalances = () => new Promise((resolve, reject) => {
    Promise.all(pairs.map(pair => pair[0].balanceOf(pair[1]))).then(res => {
      const newBalances = {};
      addresses.forEach(address => {
        newBalances[address] = {};
      });
      const balanceStrs = res.map(balance => balance.toString());
      pairs.forEach((pair, i) => {
        newBalances[pair[1]][pair[0].address] = balanceStrs[i];
      });
      resolve(newBalances);
    }).catch(e => reject(e));
  });
  return getBalances;
};
