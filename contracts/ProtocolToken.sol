pragma solidity ^0.4.8;

import "Token.sol";
import "StandardToken.sol";

contract ProtocolToken is StandardToken {

  uint8 constant public decimals = 18;
  string constant public name = "0x Network Token";
  string constant public symbol = "ZRX";

  function ProtocolToken() {
    totalSupply = 10**6*10**18;
    balances[msg.sender] = totalSupply;
  }

}
