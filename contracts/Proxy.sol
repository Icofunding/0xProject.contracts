pragma solidity ^0.4.8;

import "./base/Token.sol";
import "./db/AuthDB.sol";

contract Proxy is AuthDB {

  // only authorized addresses can invoke functions with this modifier
  modifier onlyAuthorized {
    if (!isAddressAuthorized(msg.sender)) throw;
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
}
