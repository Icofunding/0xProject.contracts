pragma solidity ^0.4.8;

import "../Ownable.sol";

contract AuthDB is Ownable {

  mapping (address => bool) public addresses;
  address[] authorities;

  event LogAuthorizedAddressAdded(address indexed target, address indexed caller);
  event LogAuthorizedAddressRemoved(address indexed target, address indexed caller);

  function addAuthorizedAddress(address target)
    onlyOwner
    returns (bool success)
  {
    addresses[target] = true;
    authorities.push(target);
    LogAuthorizedAddressAdded(target, msg.sender);
    return true;
  }

  function removeAuthorizedAddress(address target)
    onlyOwner
    returns (bool success)
  {
    delete addresses[target];
    for (uint i = 0; i < authorities.length; i++) {
      if (authorities[i] == target) {
        authorities[i] = authorities[authorities.length - 1];
        authorities.length -= 1;
        break;
      }
    }
    LogAuthorizedAddressRemoved(target, msg.sender);
    return true;
  }

  function addAuthorizedAddresses(address[] targets)
    onlyOwner
    returns (bool success)
  {
    for (uint i = 0; i < targets.length; i++) {
      addAuthorizedAddress(targets[i]);
    }
    return true;
  }

  function removeAuthorizedAddresses(address[] targets)
    onlyOwner
    returns (bool success)
  {
    for (uint i = 0; i < targets.length; i++) {
      removeAuthorizedAddress(targets[i]);
    }
    return true;
  }

  function isAddressAuthorized(address target)
    constant
    returns (bool isAuthorized)
  {
    return addresses[target];
  }

  function getAuthorizedAddresses()
    constant
    returns (address[])
  {
    return authorities;
  }
}
