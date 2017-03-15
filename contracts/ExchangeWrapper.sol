pragma solidity ^0.4.8;

import "./Exchange.sol";
import "./SafeMath.sol";

contract ExchangeWrapper is SafeMath {

  Exchange exchange;

  function ExchangeWrapper(address _exchange) {
    exchange = Exchange(_exchange);
  }

  /// @dev Fills an order with specified parameters and ECDSA signature, with caller as msg.sender.
  /// @param traders Array of order maker and taker addresses.
  /// @param feeRecipient Address that receives order fees.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param values Array of order valueM and valueT.
  /// @param fees Array of order feeM and feeT.
  /// @param expiration Time order expires in seconds.
  /// @param fillValueM Desired amount of tokenM to fill in order.
  /// @param v ECDSA signature parameter v.
  /// @param rs Array of ECDSA signature parameters r and s.
  /// @return Total amount of tokenM filled in trade.
  function fill(
    address[2] traders,
    address feeRecipient,
    address[2] tokens,
    uint256[2] values,
    uint256[2] fees,
    uint256 expiration,
    uint256 fillValueM,
    uint8 v,
    bytes32[2] rs)
  returns (uint256 filledValueM)
  {
    return exchange.fill(
      traders,
      msg.sender,
      feeRecipient,
      tokens,
      values,
      fees,
      expiration,
      fillValueM,
      v,
      rs
    );
  }

  /// @dev Fills an order with specified parameters and ECDSA signature, throws if specified amount not filled entirely.
  /// @param traders Array of order maker and taker addresses.
  /// @param feeRecipient Address that receives order fees.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param values Array of order valueM and valueT.
  /// @param fees Array of order feeM and feeT.
  /// @param expiration Time order expires in seconds.
  /// @param fillValueM Desired amount of tokenM to fill in order.
  /// @param v ECDSA signature parameter v.
  /// @param rs Array of ECDSA signature parameters r and s.
  /// @return Success of entire fillValueM being filled.
  function fillOrKill(
    address[2] traders,
    address feeRecipient,
    address[2] tokens,
    uint256[2] values,
    uint256[2] fees,
    uint256 expiration,
    uint256 fillValueM,
    uint8 v,
    bytes32[2] rs)
    returns (bool success)
  {
    assert(fill(
      traders,
      feeRecipient,
      tokens,
      values,
      fees,
      expiration,
      fillValueM,
      v,
      rs
    ) == fillValueM);
    return true;
  }

  /// @dev Synchronously executes multiple fill orders in a single transaction.
  /// @param traders Array of order maker and taker address tuples.
  /// @param feeRecipients Array of addresses that receive order fees.
  /// @param tokens Array of order tokenM and tokenT address tuples.
  /// @param values Array of order valueM and valueT tuples.
  /// @param fees Array of order feeM and feeT tuples.
  /// @param expirations Array of times orders expire in seconds.
  /// @param fillValuesM Array of desired amounts of tokenM to fill in orders.
  /// @param v Array ECDSA signature v parameters.
  /// @param rs Array of ECDSA signature parameters r and s tuples.
  /// @return True if no fills throw.
  function batchFill(
    address[2][] traders,
    address[] feeRecipients,
    address[2][] tokens,
    uint256[2][] values,
    uint256[2][] fees,
    uint256[] expirations,
    uint256[] fillValuesM,
    uint8[] v,
    bytes32[2][] rs)
    returns (bool success)
  {
    for (uint256 i = 0; i < traders.length; i++) {
      fill(
        traders[i],
        feeRecipients[i],
        tokens[i],
        values[i],
        fees[i],
        expirations[i],
        fillValuesM[i],
        v[i],
        rs[i]
      );
    }
    return true;
  }

  /// @dev Synchronously executes multiple fillOrKill orders in a single transaction.
  /// @param traders Array of order maker and taker address tuples.
  /// @param feeRecipients Array of addresses that receive order fees.
  /// @param tokens Array of order tokenM and tokenT address tuples.
  /// @param values Array of order valueM and valueT tuples.
  /// @param fees Array of order feeM and feeT tuples.
  /// @param expirations Array of times orders expire in seconds.
  /// @param fillValuesM Array of desired amounts of tokenM to fill in orders.
  /// @param v Array ECDSA signature v parameters.
  /// @param rs Array of ECDSA signature parameters r and s tuples.
  /// @return Success of all orders being filled with respective fillValueM.
  function batchFillOrKill(
    address[2][] traders,
    address[] feeRecipients,
    address[2][] tokens,
    uint256[2][] values,
    uint256[2][] fees,
    uint256[] expirations,
    uint256[] fillValuesM,
    uint8[] v,
    bytes32[2][] rs)
    returns (bool success)
  {
    for (uint256 i = 0; i < traders.length; i++) {
      assert(fillOrKill(
        traders[i],
        feeRecipients[i],
        tokens[i],
        values[i],
        fees[i],
        expirations[i],
        fillValuesM[i],
        v[i],
        rs[i]
      ));
    }
    return true;
  }

  /// @dev Synchronously executes multiple fill orders in a single transaction until total fillValueM filled.
  /// @param traders Array of order maker and taker address tuples.
  /// @param feeRecipients Array of addresses that receive order fees.
  /// @param tokens Array of order tokenM and tokenT address tuples.
  /// @param values Array of order valueM and valueT tuples.
  /// @param fees Array of order feeM and feeT tuples.
  /// @param expirations Array of times orders expire in seconds.
  /// @param fillValueM Desired total amount of tokenM to fill in orders.
  /// @param v Array ECDSA signature v parameters.
  /// @param rs Array of ECDSA signature parameters r and s tuples.
  /// @return Total amount of fillValueM filled in orders.
  function fillUntil(
    address[2][] traders,
    address[] feeRecipients,
    address[2][] tokens,
    uint256[2][] values,
    uint256[2][] fees,
    uint256[] expirations,
    uint256 fillValueM,
    uint8[] v,
    bytes32[2][] rs)
    returns (uint256 filledValueM)
  {
    address tokenM = tokens[0][0];
    uint256 fillValueMLeft = fillValueM;
    for (uint256 i = 0; i < traders.length; i++) {
      assert(tokenM == tokens[i][0]);
      fillValueMLeft = safeSub(fillValueMLeft, fill(
        traders[i],
        feeRecipients[i],
        tokens[i],
        values[i],
        fees[i],
        expirations[i],
        fillValueMLeft,
        v[i],
        rs[i]
      ));
      if (fillValueMLeft == 0) break;
    }
    return safeSub(fillValueM, fillValueMLeft);
  }

  /// @dev Cancels provided amount of an order with given parameters and caller as msg.sender.
  /// @param traders Array of order maker and taker addresses.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param values Array of order valueM and valueT.
  /// @param expiration Time order expires in seconds.
  /// @param fillValueM Desired amount of tokenM to cancel in order.
  /// @return Amount of tokenM cancelled.
  function cancel(
    address[2] traders,
    address[2] tokens,
    uint256[2] values,
    uint256 expiration,
    uint256 fillValueM)
    returns (uint256 cancelledValueM)
  {
    return exchange.cancel(
      traders,
      msg.sender,
      tokens,
      values,
      expiration,
      fillValueM
    );
  }

  /// @dev Synchronously cancels multiple orders in a single transaction.
  /// @param traders Array of order maker and taker address tuples.
  /// @param tokens Array of order tokenM and tokenT address tuples.
  /// @param values Array of order valueM and valueT tuples.
  /// @param expirations Array of times orders expire in seconds.
  /// @param fillValuesM Array of desired amounts of tokenM to cancel in orders.
  /// @return Success of all orders being cancelled with at least desired amounts.
  function batchCancel(
    address[2][] traders,
    address[2][] tokens,
    uint256[2][] values,
    uint256[] expirations,
    uint256[] fillValuesM)
    returns (bool success)
  {
    for (uint256 i = 0; i < traders.length; i++) {
      cancel(
        traders[i],
        tokens[i],
        values[i],
        expirations[i],
        fillValuesM[i]
      );
    }
    return true;
  }

}
