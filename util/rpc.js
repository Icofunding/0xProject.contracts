const request = require('request-promise-native');
const truffleConf = require('./../truffle.js');

class RPC {
  constructor() {
    this._host = truffleConf.networks.development.host;
    this._port = truffleConf.networks.development.port;
    this._id = 0;
  }
  async increaseTimeAsync(time) {
    const method = 'evm_increaseTime';
    const params = [time];
    const payload = this._toPayload(method, params);
    return this._sendAsync(payload);
  }
  _toPayload(method, params = []) {
    const payload = JSON.stringify({
      id: this._id,
      method,
      params,
    });
    this._id += 1;
    return payload;
  }
  async _sendAsync(payload) {
    const opts = {
      method: 'POST',
      uri: `http://${this._host}:${this._port}`,
      body: payload,
    };
    const body = await request(opts);
    return body.result;
  }
}

module.exports = RPC;
