pragma solidity ^0.4.2;

contract Owned {

  address public owner;

  function Owned() {
    owner = msg.sender;
  }

  // only the owner address can invoke functions with this modifier
  modifier onlyOwner() {
    if (msg.sender != owner)
    throw;
    _;
  }

}
