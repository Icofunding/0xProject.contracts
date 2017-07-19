pragma solidity ^0.4.11;

import "./../base/StandardToken.sol";

contract ZRXToken is StandardToken {
  
    uint8 constant public decimals = 18;
    string constant public name = "0x Protocol Token";
    string constant public symbol = "ZRX";

    function ZRXToken() {
        totalSupply = 10**27; // 1 billion tokens, 18 decimal places
        balances[msg.sender] = totalSupply;
    }

}
