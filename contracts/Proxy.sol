pragma solidity ^0.4.8;

import "./tokens/Token.sol";
import "./Ownable.sol";

contract Proxy is Ownable {

  // stores authorized addresses
  mapping (address => bool) public authorities;
  mapping (address => mapping (address => bool)) public optedOut;

  event LogAuthorizationChange(address indexed target, address indexed caller, bool authorized);
  event LogPersonalAuthorizationChange(address indexed target, address indexed caller, bool optedOut);

  // only authorized addresses can invoke functions with this modifier
  modifier onlyAuthorized {
    if (authorities[msg.sender] != true) throw;
    _;
  }

  // Proxy calls into ERC20 Token contract, invoking transferFrom
  function transferFrom(
    address _token,
    address _from,
    address _to,
    uint _value)
    onlyAuthorized
    returns (bool success)
  {
    if (isOptedOut(msg.sender, _from)) throw;
    if (!Token(_token).transferFrom(_from, _to, _value)) throw;
    return true;
  }

  function setAuthorization(address _target, bool _authorized)
    onlyOwner
    returns (bool success)
  {
    authorities[_target] = _authorized;
    LogAuthorizationChange(_target, msg.sender, _authorized);
    return true;
  }

  function setPersonalAuthorization(address _target, bool _optedOut)
    returns (bool success)
  {
    optedOut[_target][msg.sender] = _optedOut;
    LogPersonalAuthorizationChange(_target, msg.sender, _optedOut);
    return true;
  }

  function isAuthorized(address _target)
    constant
    returns (bool _authorized)
  {
    return authorities[_target];
  }

  function isOptedOut(address _target, address _caller)
    constant
    returns (bool _optedOut)
  {
    return optedOut[_target][_caller];
  }
}
