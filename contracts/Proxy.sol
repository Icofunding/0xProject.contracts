pragma solidity ^0.4.7;
import "Token.sol";
import "Owned.sol";

contract Proxy is Owned {

  // address of decentralized governance contract (multi-sig, DAO, ...)
  address public owner;

  // maps addresses of Exchange contracts to true
  mapping (address => bool) public whitelist;

  // only the owner address can invoke functions with this modifier
  modifier onlyOwner {
    if (msg.sender != owner) throw;
    _;
  }

  // only whitelisted addresses can invoke functions with this modifier
  modifier onlyWhitelist {
    if (whitelist[msg.sender] != true) throw;
    _;
  }

  // constructor
  function Proxy() {
    //
  }

  // Proxy calls into ERC20 Token contract, invoking transferFrom
  function transferFrom(address _token, address _from, address _to, uint _value) onlyWhitelist  returns (bool success) {
    Token(_token).transferFrom(_from,_to,_value);
    return true;
  }

}
