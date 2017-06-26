import * as _ from 'lodash';
import * as assert from 'assert';

export const testUtil = {
  assertThrow(err: Error) {
    const errMsg = `${err}`;
    const didCalledContractThrowInternal = _.includes(errMsg, 'invalid opcode');
    const didCalledContractThrowManual = _.includes(errMsg, 'invalid JUMP');
    const didNestedContractThrow = _.includes(errMsg, 'out of gas');
    const didGethContractThrow = _.includes(errMsg, 'please check your gas amount');
    assert(didCalledContractThrowInternal || didNestedContractThrow || didCalledContractThrowManual ||
           didGethContractThrow, `Expected contract to throw, got: ${err}`);
  },
};
