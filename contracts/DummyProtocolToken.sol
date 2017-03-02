pragma solidity ^0.4.8;

import "./ProtocolToken.sol";

contract DummyProtocolToken is ProtocolToken {

  function buy(uint256 _value) {
    balances[msg.sender] += _value;
    totalSupply += _value;
  }

}
