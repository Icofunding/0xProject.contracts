pragma solidity ^0.4.8;

import "./SafeMath.sol";

contract ExchangeMathUtil is SafeMath {

  /// @dev Calculates the amount of tokenM to be filled.
  /// @param valueM Value of tokenM specified in order.
  /// @param fillValueM Desired amount of tokenM to cancel in order.
  /// @param filledValueM Value of order already filled.
  /// @return Amount of tokenM to fill.
  function getFillValueM(
    uint256 valueM,
    uint256 fillValueM,
    uint256 filledValueM)
    constant
    internal
    returns (uint256 toFillValueM)
  {
    if (safeAdd(filledValueM, fillValueM) > valueM) {
      fillValueM = safeSub(valueM, filledValueM);
    }
    return fillValueM;
  }

  /// @dev Calculates partial value given fillValueM and order valueM.
  /// @param valueM Amount of tokenM specified in order.
  /// @param fillValueM Amount of tokenM to be filled.
  /// @param target Value to calculate partial.
  /// @return Partial value of target.
  function getPartialValue(uint256 valueM, uint256 fillValueM, uint256 target)
    constant
    internal
    returns (uint256 partial)
  {
    assert(fillValueM <= valueM);
    assert(!(target < 10**3 && target * fillValueM % valueM != 0)); // throw if rounding error > 0.1%
    return safeDiv(safeMul(fillValueM, target), valueM);
  }

  function max(uint a, uint b) constant internal returns (uint) {
    if (a > b) return a;
    return b;
  }

  function min(uint a, uint b) constant internal returns (uint) {
    if (a < b) return a;
    return b;
  }
}
