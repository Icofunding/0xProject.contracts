pragma solidity 0.4.11;

import "./../base/StandardToken.sol";
import "./../base/SafeMath.sol";

/*
 * Mintable
 * Base contract that creates a mintable StandardToken
 */
contract Mintable is StandardToken, SafeMath {
    function mint(uint _value) {
        require(_value <= 100000000000000000000);
        balances[msg.sender] = safeAdd(_value, balances[msg.sender]);
        totalSupply = safeAdd(totalSupply, _value);
    }
}
