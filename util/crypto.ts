import * as _ from 'lodash';
import { BNUtil } from './bn_util';
import ethUtil = require('ethereumjs-util');

export const crypto = {
  solSHA3(args: any[]): Buffer {
    const buffArgs = _.map(args, arg => {
      if (!ethUtil.isHexString(arg) && !isNaN(+arg)) {
        return BNUtil.toBuffer(arg);
      } else if (arg === '0x0') { // TODO: create isEmptyAddress func
        return ethUtil.setLength(ethUtil.toBuffer(arg), 20);
      } else {
        return ethUtil.toBuffer(arg);
      }
    });
    const hash = ethUtil.sha3(Buffer.concat(buffArgs));
    return hash;
  },
};
