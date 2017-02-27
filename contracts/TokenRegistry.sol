pragma solidity ^0.4.8;

import "Token.sol";
import "Ownable.sol";

contract TokenRegistry is Ownable {

    address[] public tokenContracts;
    mapping (address => uint) public tokenIndex;
    mapping (address => TokenInfo) public tokens;


    struct TokenInfo {
        address addr;
        bytes32 symbol;
        bytes32 name;
        uint8 decimals;
    }

    function addToken(
      address _addr,
      bytes32 _symbol,
      bytes32 _name,
      uint8 _decimals
      ) returns (bool success) {
        tokenContracts.push(_addr);
        tokenIndex[_addr] = tokenContracts.length;
        tokens[_addr] = TokenInfo({
            addr: _addr,
            symbol: _symbol,
            name: _name,
            decimals: _decimals
        });
        return true;
    }

    function removeToken(address _addr) returns (bool success) {
        tokenContracts[tokenIndex[_addr]] = 0x0;
        tokenIndex[_addr] = 0;
        delete tokens[_addr];
        return true;
    }

    //////////////////////////////////////////////////////////////////////////////

    // Accessors

    function getBalance(address token, address owner) constant returns(uint balance) {
      return Token(token).balanceOf(owner);
    }

    function getAllowance(address token, address owner, address spender) constant returns(uint remaining) {
      return Token(token).allowance(owner, spender);
    }

    function getBalances(address owner) constant returns(address[], uint[]) {
      uint length = tokenContracts.length;
      address[] memory addr = new address[](length);
      uint[] memory balances = new uint[](length);

      for (uint i = 0; i < length; i++) {
        addr[i] = tokenContracts[i];
        balances[i] = getBalance(tokenContracts[i], owner);
      }

      return (addr, balances);
    }

    function getAllowances(address owner, address spender) constant returns(address[], uint[]) {
      uint length = tokenContracts.length;
      address[] memory addr = new address[](length);
      uint[] memory allowances = new uint[](length);

      for (uint i = 0; i < length; i++) {
        addr[i] = tokenContracts[i];
        allowances[i] = getAllowance(tokenContracts[i], owner, spender);
      }

      return (addr, allowances);
    }

    function getTokens() constant returns (address[], bytes32[], bytes32[], uint8[]) {
      uint length = tokenContracts.length;
      address[] memory addr = new address[](length);
      bytes32[] memory symbol = new bytes32[](length);
      bytes32[] memory name = new bytes32[](length);
      uint8[] memory decimals = new uint8[](length);

      for (uint i = 0; i < length; i++) {
        addr[i] = tokenContracts[i];
        symbol[i] = tokens[tokenContracts[i]].symbol;
        name[i] = tokens[tokenContracts[i]].name;
        decimals[i] = tokens[tokenContracts[i]].decimals;
      }
      return (addr, symbol, name, decimals);
    }

    function getTokenAddresses() constant returns (address[]) {
      return tokenContracts;
    }

    function getToken(address _addr) constant returns (address addr, bytes32 symbol, bytes32 name, uint decimals) {
      TokenInfo memory token;
      token = tokens[_addr];
      return (token.addr, token.symbol, token.name, token.decimals);
    }

    function getDecimals(address _addr) constant returns (uint8 decimals) {
      return tokens[_addr].decimals;
    }

}
