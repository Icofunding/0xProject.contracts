pragma solidity ^0.4.8;

import "Token.sol";
import "StandardToken.sol";

contract DummyToken is StandardToken {

  function DummyToken(uint256 _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function create(uint256 _value) {
    balances[msg.sender] += _value;
    totalSupply += _value;
  }
}
