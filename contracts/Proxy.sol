pragma solidity ^0.4.8;

import "./tokens/Token.sol";
import "./db/AuthDB.sol";

contract Proxy {

  address public AUTH_DB;

  // only authorized addresses can invoke functions with this modifier
  modifier onlyAuthorized {
    if (!AuthDB(AUTH_DB).isAddressAuthorized(msg.sender)) throw;
    _;
  }

  function Proxy(address _authDB) {
    AUTH_DB = _authDB;
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
