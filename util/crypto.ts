import * as _ from 'lodash';
import BN = require('bn.js');
import { BNUtil } from './bn_util';
import ethUtil = require('ethereumjs-util');
import ABI = require('ethereumjs-abi');
import BigNumber = require('bignumber.js');

export const crypto = {
  solSHA3(args: any[]): Buffer {
    const argTypes: string[] = [];
    _.each(args, (arg, i) => {
      const isNumber = _.isFinite(arg);
      if (isNumber) {
        argTypes.push('uint8');
      } else if ((arg as BigNumber).isBigNumber) {
        argTypes.push('uint256');
        args[i] = new BN(arg.toString(10), 10);
      } else if (ethUtil.isValidAddress(arg)) {
        argTypes.push('address');
      } else if (_.isString(arg)) {
        argTypes.push('string');
      } else if  (_.isBoolean(arg)) {
        argTypes.push('bool');
      } else {
        throw new Error(`Unable to guess arg type: ${arg}`);
      }
    });
    const hash = ABI.soliditySHA3(argTypes, args);
    return hash;
  },
};
