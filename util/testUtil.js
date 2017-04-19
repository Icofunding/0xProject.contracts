const assert = require('assert');

const testUtil = {
  assertThrow(err) {
    const errMsg = `${err}`;
    const didCalledContractThrow = errMsg.indexOf('invalid JUMP') > -1;
    const didNestedContractThrow = errMsg.indexOf('out of gas') > -1;
    const didGethContractThrow = errMsg.indexOf('please check your gas amount') > -1;
    assert(didCalledContractThrow || didNestedContractThrow ||
           didGethContractThrow, `Expected contract to throw, got: ${err}`);
  },
};

module.exports = testUtil;
