pragma solidity ^0.4.8;

import "./../base/StandardToken.sol";

// DummyTokenC is not mintable and is also not included in the TokenRegistry
contract DummyTokenC is StandardToken {
  string public name = "TokenC";
  string public symbol = "TC";

  function DummyTokenC(uint _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function setBalance(uint _value) {
    balances[msg.sender] = _value;
  }
}
