pragma solidity ^0.4.8;

import "./base/Token.sol";
import "./db/AuthDB.sol";

contract Proxy is AuthDB {

  /// @dev Only authorized addresses can invoke functions with this modifier.
  modifier onlyAuthorized {
    if (!isAddressAuthorized(msg.sender)) throw;
    _;
  }

  /// @dev Calls into ERC20 Token contract, invoking transferFrom.
  /// @param token Address of token to transfer.
  /// @param from Address to transfer token from.
  /// @param to Address to transfer token to.
  /// @param value Amount of token to transfer.
  /// @return Success of transfer.
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
}
