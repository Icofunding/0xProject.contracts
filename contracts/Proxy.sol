pragma solidity ^0.4.8;

import "./tokens/Token.sol";
import "./Ownable.sol";

contract Proxy is Ownable {

  // stores authorized addresses
  mapping (address => bool) public authorities;

  event LogAuthorizationChange(address indexed target, bool value, address indexed caller);

  // only authorized addresses can invoke functions with this modifier
  modifier onlyAuthorized {
    if (authorities[msg.sender] != true) throw;
    _;
  }

  // Proxy calls into ERC20 Token contract, invoking transferFrom
  function transferFrom(
    address token,
    address from,
    address to,
    uint value)
    onlyAuthorized
    returns (bool success)
  {
    if (!Token(token).transferFrom(from, to, value)) throw;
    return true;
  }

  function setAuthorization(address target, bool value)
    onlyOwner
    returns (bool success)
  {
    authorities[target] = value;
    LogAuthorizationChange(target, value, msg.sender);
    return true;
  }

  function isAuthorized(address target)
    constant
    returns (bool value)
  {
    return authorities[target];
  }
}
