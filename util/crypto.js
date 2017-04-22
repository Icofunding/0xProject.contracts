const _ = require('lodash');
const ethUtil = require('ethereumjs-util');
const BNUtil = require('./BNUtil.js');

const crypto = {
  solSHA3(...args) {
    const solSha3 = ethUtil.sha3(Buffer.concat(_.map(args, arg => {
      if (!ethUtil.isHexString(arg) && !isNaN(+arg)) {
        return BNUtil.toBuffer(arg);
      }
      if (arg === '0x0') { // TODO: create isEmptyAddress func
        return ethUtil.setLength(ethUtil.toBuffer(arg), 20);
      }
      return ethUtil.toBuffer(arg);
    })));
    return solSha3;
  },
};

module.exports = crypto;
