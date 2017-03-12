pragma solidity ^0.4.8;

import "./StandardToken.sol";

contract DummyProtocolToken is StandardToken {
  string public name = "Protocol Token";
  string public symbol = "PT";

  function DummyProtocolToken(uint256 _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function setBalance(uint256 _value) {
    balances[msg.sender] = _value;
  }
}
