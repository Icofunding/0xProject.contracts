pragma solidity ^0.4.8;

import "./Mintable.sol";

contract DummyTokenB is Mintable {
  uint8 constant public decimals = 18;
  string constant public name = "TokenB";
  string constant public symbol = "TB";

  function DummyTokenB(uint _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function setBalance(uint _value) {
    balances[msg.sender] = _value;
  }
}
