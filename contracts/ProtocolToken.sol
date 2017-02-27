pragma solidity ^0.4.8;

import "Token.sol";
import "StandardToken.sol";

contract ProtocolToken is StandardToken {

  uint8 constant public decimals = 18;
  string constant public name = "0x Network Token";
  string constant public symbol = "ZRX";

  function ProtocolToken() {
    totalSupply = 10**25; // 10M tokens, 18 decimal places
    balances[msg.sender] = totalSupply;
  }

}
