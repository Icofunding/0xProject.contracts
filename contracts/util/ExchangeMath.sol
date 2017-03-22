pragma solidity ^0.4.8;

import "./SafeMath.sol";

contract ExchangeMath is SafeMath {

  /// @dev Calculates the amount of tokenM to be filled.
  /// @param valueM Value of tokenM specified in order.
  /// @param fillValueM Desired amount of tokenM to cancel in order.
  /// @param filledValueM Value of order already filled.
  /// @return Amount of tokenM to fill.
  function getFillValueM(
    uint valueM,
    uint fillValueM,
    uint filledValueM)
    constant
    returns (uint toFillValueM)
  {
    if (safeAdd(filledValueM, fillValueM) > valueM) {
      fillValueM = safeSub(valueM, filledValueM);
    }
    return fillValueM;
  }

  /// @dev Calculates partial value given fillValueM and order valueM.
  /// @param value Amount of token specified in order.
  /// @param fillValue Amount of token to be filled.
  /// @param target Value to calculate partial.
  /// @return Partial value of target.
  function getPartialValue(uint value, uint fillValue, uint target)
    constant
    returns (uint partial)
  {
    assert(fillValue <= value);
    assert(!(target < 10**3 && target * fillValue % value != 0)); // throw if rounding error > 0.1%
    return safeDiv(safeMul(fillValue, target), value);
  }
}
