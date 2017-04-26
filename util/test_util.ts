import * as _ from 'lodash';
import * as assert from 'assert';

export const testUtil = {
  assertThrow(err: Error) {
    const errMsg = `${err}`;
    const didCalledContractThrow = _.includes(errMsg, 'invalid JUMP');
    const didNestedContractThrow = _.includes(errMsg, 'out of gas');
    const didGethContractThrow = _.includes(errMsg, 'please check your gas amount');
    assert(didCalledContractThrow || didNestedContractThrow ||
           didGethContractThrow, `Expected contract to throw, got: ${err}`);
  },
};
