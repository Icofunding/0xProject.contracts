pragma solidity ^0.4.8;

import "./StandardToken.sol";

contract DummyTokenA is StandardToken {

  function DummyTokenA(uint256 _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function setBalance(uint256 _value) {
    balances[msg.sender] = _value;
  }
}
