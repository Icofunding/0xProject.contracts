pragma solidity ^0.4.8;

import "./StandardToken.sol";

contract DummyTokenA is StandardToken {
  string public name = "TokenA";
  string public symbol = "TA";

  function DummyTokenA(uint256 _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function setBalance(uint256 _value) {
    balances[msg.sender] = _value;
  }
}
