pragma solidity ^0.4.8;

import "./../base/StandardToken.sol";

contract DummyProtocolToken is StandardToken {
  uint8 constant public decimals = 18;
  string public name = "Protocol Token";
  string public symbol = "PT";

  function DummyProtocolToken(uint _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function setBalance(uint _value) {
    balances[msg.sender] = _value;
  }
}
