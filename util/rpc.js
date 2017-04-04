const request = require('request');
const truffleConf = require('../truffle.js');

const host = truffleConf.networks.development.host;
const port = truffleConf.networks.development.port;

let id = 0;

exports.increaseTime = time => {
  const data = JSON.stringify({
    id,
    method: 'evm_increaseTime',
    params: [time],
  });
  id += 1;

  return new Promise((resolve, reject) => {
    const opts = {
      method: 'POST',
      uri: `http://${host}:${port}`,
      body: data,
    };
    request(opts, (err, body, res) => {
      if (err) {
        reject(err);
        console.warn('The evm_increaseTime method is only compatible with testrpc');
      }
      resolve(res);
    });
  });
};
