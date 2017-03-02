pragma solidity ^0.4.8;

import "./StandardToken.sol";

contract DummyProtocolToken is StandardToken {

  function DummyProtocolToken(uint256 _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function buy(uint256 _value) {
    balances[msg.sender] += _value;
    totalSupply += _value;
  }

}
