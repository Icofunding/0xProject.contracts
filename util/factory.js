exports.getBalancesFactory = (tokens, addresses) => {
  const pairs = [];
  tokens.forEach(token => {
    addresses.forEach(address => pairs.push([token, address]));
  });
  const getBalances = async () => {
    const res = await Promise.all(pairs.map(pair => pair[0].balanceOf(pair[1])));
    const newBalances = {};
    addresses.forEach(address => {
      newBalances[address] = {};
    });
    const balanceStrs = res.map(balance => balance.toString());
    pairs.forEach((pair, i) => {
      newBalances[pair[1]][pair[0].address] = balanceStrs[i];
    });
    return newBalances;
  };
  return getBalances;
};
