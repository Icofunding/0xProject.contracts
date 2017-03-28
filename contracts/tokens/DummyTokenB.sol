pragma solidity ^0.4.8;

import "./Mintable.sol";

contract DummyTokenB is Mintable {
  string public name = "TokenB";
  string public symbol = "TB";

  function DummyTokenB(uint _value) {
    balances[msg.sender] = _value;
    totalSupply = _value;
  }

  function setBalance(uint _value) {
    balances[msg.sender] = _value;
  }
}
