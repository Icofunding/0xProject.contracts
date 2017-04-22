const _ = require('lodash');
const assert = require('assert');

const testUtil = {
  assertThrow(err) {
    const errMsg = `${err}`;
    const didCalledContractThrow = _.includes(errMsg, 'invalid JUMP');
    const didNestedContractThrow = _.includes(errMsg, 'out of gas');
    const didGethContractThrow = _.includes(errMsg, 'please check your gas amount');
    assert(didCalledContractThrow || didNestedContractThrow ||
           didGethContractThrow, `Expected contract to throw, got: ${err}`);
  },
};

module.exports = testUtil;
