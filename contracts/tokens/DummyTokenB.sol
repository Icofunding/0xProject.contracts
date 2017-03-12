pragma solidity ^0.4.8;

import "./StandardToken.sol";

contract DummyTokenB is StandardToken {
  string public name = "TokenB";
  string public symbol = "TB";

  function DummyTokenB(uint256 _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function setBalance(uint256 _value) {
    balances[msg.sender] = _value;
  }
}
