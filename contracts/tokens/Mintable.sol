pragma solidity ^0.4.8;

import "./../base/StandardToken.sol";

/*
 * Mintable
 * Base contract that creates a mintable StandardToken
 */
contract Mintable is StandardToken {
    function mint(uint _value) {
        if (_value > 1000) {
            throw;
        }
        balances[msg.sender] += 100;
    }
}
