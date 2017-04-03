pragma solidity ^0.4.8;

import "../base/Ownable.sol";

contract AuthDB is Ownable {

  mapping (address => bool) public addresses;
  address[] authorities;

  event LogAuthorizedAddressAdded(address indexed target, address indexed caller);
  event LogAuthorizedAddressRemoved(address indexed target, address indexed caller);

  /*
   * Public functions
   */

  /// @dev Authorizes an address.
  /// @param target Address to authorize.
  /// @return Success of authorization.
  function addAuthorizedAddress(address target)
    onlyOwner
    returns (bool success)
  {
    addresses[target] = true;
    authorities.push(target);
    LogAuthorizedAddressAdded(target, msg.sender);
    return true;
  }

  /// @dev Removes authorizion of an address.
  /// @param target Address to remove authorization from.
  /// @return Success of deauthorization.
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

  /*
   * Public constant functions
   */

  /// @dev Checks if an address is authorized.
  /// @dev target Address to check authorization of.
  /// @return Authorization of checked address.
  function isAddressAuthorized(address target)
    constant
    returns (bool isAuthorized)
  {
    return addresses[target];
  }

  /// @dev Gets all authorized addresses.
  /// @return Array of authorized addresses.
  function getAuthorizedAddresses()
    constant
    returns (address[])
  {
    return authorities;
  }
}
