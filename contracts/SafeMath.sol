pragma solidity ^0.4.8;

contract SafeMath {

  function safeMul(uint a, uint b) constant internal returns (uint) {
    uint c = a * b;
    assert(a == 0 || c / a == b);
    return c;
  }

  function safeSub(uint a, uint b) constant internal returns (uint) {
    assert(b <= a);
    return a - b;
  }

  function safeAdd(uint a, uint b) constant internal returns (uint) {
    uint c = a + b;
    assert(c >= a && c >= b);
    return c;
  }

  function safeDiv(uint a, uint b) constant internal returns (uint) {
    assert(b > 0);
    uint c = a / b;
    assert(a == b * c + a % b);
    return c;
  }

  function max(uint a, uint b) constant internal returns (uint) {
    if (a > b) return a;
    return b;
  }

  function min(uint a, uint b) constant internal returns (uint) {
    if (a < b) return a;
    return b;
  }

  function assert(bool assertion) internal {
    if (!assertion) throw;
  }
}
