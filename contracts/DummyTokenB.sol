pragma solidity ^0.4.8;

import "./Token.sol";
import "./StandardToken.sol";

contract DummyTokenB is StandardToken {

  function DummyTokenB(uint256 _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function buy(uint256 _value) {
    balances[msg.sender] += _value;
    totalSupply += _value;
  }
}
