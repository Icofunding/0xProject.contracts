pragma solidity ^0.4.8;

import "./tokens/Token.sol";
import "./Ownable.sol";

contract Proxy is Ownable {

  // stores authorized addresses
  mapping (address => bool) public authorities;
  mapping (address => mapping (address => bool)) public optedOut;

  event LogAuthorizationChange(address indexed target, address indexed caller, bool authorized);
  event LogPersonalAuthorizationChange(address indexed authority, address indexed caller, bool optedOut);

  // only authorized addresses can invoke functions with this modifier
  modifier onlyAuthorized {
    if (!authorities[msg.sender]) throw;
    _;
  }

  modifier notOptedOut(address _target) {
    if (optedOut[msg.sender][_target]) throw;
    _;
  }

  /// @dev Proxy calls into ERC20 Token contract, invoking transferFrom if called by an authorized address.
  /// @param _token Address of token to transfer.
  /// @param _from Address to transfer token from, cannot be opted out.
  /// @param _to Address to transfer token to.
  /// @param _value Amount of tokens to transfer.
  /// @return Success of transfer.
  function transferFrom(
    address _token,
    address _from,
    address _to,
    uint _value)
    onlyAuthorized
    notOptedOut(_from)
    returns (bool success)
  {
    if (!Token(_token).transferFrom(_from, _to, _value)) throw;
    return true;
  }

  /// @dev Sets authorization of target address if called by Proxy owner.
  /// @param _target Address to set authorization of.
  /// @param _authorized Value of authorization.
  /// @return Success of authorization change.
  function setAuthorization(address _target, bool _authorized)
    onlyOwner
    returns (bool success)
  {
    authorities[_target] = _authorized;
    LogAuthorizationChange(_target, msg.sender, _authorized);
    return true;
  }

  /// @dev Allows caller to opt in or out of allowing an authorized address to transfer caller's tokens.
  /// @param _authority Address of the authority to opt in or out of.
  /// @param _optedOut Value of opt out to set for caller.
  /// @return Success of personal authorization change.
  function setPersonalAuthorization(address _authority, bool _optedOut)
    returns (bool success)
  {
    optedOut[_authority][msg.sender] = _optedOut;
    LogPersonalAuthorizationChange(_authority, msg.sender, _optedOut);
    return true;
  }

  /// @dev Checks if address is authorized.
  /// @param _target Address to check authorization for.
  /// @return Value of authorization for target address.
  function isAuthorized(address _target)
    constant
    returns (bool _authorized)
  {
    return authorities[_target];
  }

  /// @dev Checks if address has opted out from an authorized address.
  /// @param _authority Authorized address.
  /// @param _target Address to check if opted out.
  /// @return Value of optedOut for target and authority.
  function isOptedOut(address _authority, address _target)
    constant
    returns (bool _optedOut)
  {
    return optedOut[_authority][_target];
  }
}
