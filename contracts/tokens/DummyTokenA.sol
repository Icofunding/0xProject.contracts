pragma solidity ^0.4.8;

import "./Mintable.sol";

contract DummyTokenA is Mintable {
  uint8 constant public decimals = 18;
  string constant public name = "TokenA";
  string constant public symbol = "TA";

  function DummyTokenA(uint _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function setBalance(uint _value) {
    balances[msg.sender] = _value;
  }
}
