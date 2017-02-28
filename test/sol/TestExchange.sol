pragma solidity ^0.4.8;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../../contracts/Exchange.sol";
import "../../contracts/Token.sol";

contract TestExchange {
  Exchange exchange = Exchange(DeployedAddresses.Exchange());
  Token dummyA = Token(DeployedAddresses.DummyTokenA());
  Token dummyB = Token(DeployedAddresses.DummyTokenB());
}
