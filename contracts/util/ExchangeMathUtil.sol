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

  /// @dev Calculates amount of tokenT to fill.
  /// @param valueM Amount of tokenM specified in order.
  /// @param valueT Amount of tokenT specified in order.
  /// @param fillValueM Amount of tokenM to be filled.
  /// @return Amount of tokenT to fill.
  function getFillValueT(uint256 valueM, uint256 valueT, uint256 fillValueM)
    constant
    internal
    returns (uint256 fillValueT)
  {
    assert(fillValueM <= valueM);
    assert(!(valueT < 10**4 && valueT * fillValueM % valueM != 0)); // throw if rounding error > 0.01%
    return safeMul(fillValueM, valueT) / valueM;
  }

  /// @dev Calculates fee to be paid for fill.
  /// @param valueM Amount of tokenM specified in order.
  /// @param fillValueM Amount of tokenM to be filled.
  /// @param fee Amount of feeM or feeT specified in order.
  /// @return Amount of feeM or feeT to be paid for fill.
  function getFeeValue(uint256 valueM, uint256 fillValueM, uint256 fee)
    constant
    internal
    returns (uint256 feeValue)
  {
    return safeDiv(safeMul(fee, fillValueM), valueM);
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
