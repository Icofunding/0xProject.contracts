const _ = require('lodash');

class Balances {
  constructor(tokens, addresses) {
    this._tokens = tokens;
    this._addresses = addresses;
  }
  async getAsync() {
    const pairs = [];
    this._tokens.forEach(token => {
      this._addresses.forEach(address => pairs.push([token, address]));
    });
    const res = await Promise.all(_.map(pairs, pair => pair[0].balanceOf(pair[1])));
    const newBalances = {};
    this._addresses.forEach(address => {
      newBalances[address] = {};
    });
    const balanceStrs = _.map(res, balance => balance.toString());
    pairs.forEach((pair, i) => {
      newBalances[pair[1]][pair[0].address] = balanceStrs[i];
    });
    return newBalances;
  }
}

module.exports = Balances;
