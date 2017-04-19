const request = require('request-promise-native');
const truffleConf = require('../truffle.js');

const host = truffleConf.networks.development.host;
const port = truffleConf.networks.development.port;

let id = 0;

const toPayload = ({ method, params = [] }) => {
  const payload = JSON.stringify({
    id,
    method,
    params,
  });
  id += 1;
  return payload;
};

const send = async payload => {
  const opts = {
    method: 'POST',
    uri: `http://${host}:${port}`,
    body: payload,
  };
  const body = await request(opts);
  return body.result;
};

exports.snapshot = () => {
  const payload = toPayload({ method: 'evm_snapshot' });
  return send(payload);
};

exports.revert = snapId => {
  const payload = toPayload({ method: 'evm_revert', params: [snapId] });
  return send(payload);
};

exports.increaseTime = time => {
  const payload = toPayload({ method: 'evm_increaseTime', params: [time] });
  return send(payload);
};
