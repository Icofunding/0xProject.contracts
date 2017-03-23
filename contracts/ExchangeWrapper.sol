pragma solidity ^0.4.8;

import "./Exchange.sol";
import "./util/SafeMath.sol";

contract ExchangeWrapper is SafeMath {

  Exchange exchange;

  function ExchangeWrapper(address _exchange) {
    exchange = Exchange(_exchange);
  }

  /// @dev Fills an order with specified parameters and ECDSA signature, with caller as msg.sender.
  /// @param traders Array of order maker and taker addresses.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param feeRecipient Address that receives order fees.
  /// @param values Array of order valueM and valueT.
  /// @param fees Array of order feeM and feeT.
  /// @param expiration Time order expires in seconds.
  /// @param fillValueM Desired amount of tokenM to fill in order.
  /// @param v ECDSA signature parameter v.
  /// @param rs Array of ECDSA signature parameters r and s.
  /// @return Total amount of tokenM filled in trade.
  function fill(
    address[2] traders,
    address[2] tokens,
    address feeRecipient,
    uint[2] values,
    uint[2] fees,
    uint expiration,
    uint fillValueM,
    uint8 v,
    bytes32[2] rs)
  returns (uint filledValueM)
  {
    return exchange.fill(
      traders,
      tokens,
      msg.sender,
      feeRecipient,
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
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param feeRecipient Address that receives order fees.
  /// @param values Array of order valueM and valueT.
  /// @param fees Array of order feeM and feeT.
  /// @param expiration Time order expires in seconds.
  /// @param fillValueM Desired amount of tokenM to fill in order.
  /// @param v ECDSA signature parameter v.
  /// @param rs Array of ECDSA signature parameters r and s.
  /// @return Success of entire fillValueM being filled.
  function fillOrKill(
    address[2] traders,
    address[2] tokens,
    address feeRecipient,
    uint[2] values,
    uint[2] fees,
    uint expiration,
    uint fillValueM,
    uint8 v,
    bytes32[2] rs)
    returns (bool success)
  {
    assert(fill(
      traders,
      tokens,
      feeRecipient,
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
  /// @param tokens Array of order tokenM and tokenT address tuples.
  /// @param feeRecipients Array of addresses that receive order fees.
  /// @param values Array of order valueM and valueT tuples.
  /// @param fees Array of order feeM and feeT tuples.
  /// @param expirations Array of times orders expire in seconds.
  /// @param fillValueM Array of desired amounts of tokenM to fill in orders.
  /// @param v Array ECDSA signature v parameters.
  /// @param rs Array of ECDSA signature parameters r and s tuples.
  /// @return True if no fills throw.
  function batchFill(
    address[2][] traders,
    address[2][] tokens,
    address[] feeRecipients,
    uint[2][] values,
    uint[2][] fees,
    uint[] expirations,
    uint[] fillValueM,
    uint8[] v,
    bytes32[2][] rs)
    returns (bool success)
  {
    for (uint i = 0; i < traders.length; i++) {
      fill(
        traders[i],
        tokens[i],
        feeRecipients[i],
        values[i],
        fees[i],
        expirations[i],
        fillValueM[i],
        v[i],
        rs[i]
      );
    }
    return true;
  }

  /// @dev Synchronously executes multiple fillOrKill orders in a single transaction.
  /// @param traders Array of order maker and taker address tuples.
  /// @param tokens Array of order tokenM and tokenT address tuples.
  /// @param feeRecipients Array of addresses that receive order fees.
  /// @param values Array of order valueM and valueT tuples.
  /// @param fees Array of order feeM and feeT tuples.
  /// @param expirations Array of times orders expire in seconds.
  /// @param fillValueM Array of desired amounts of tokenM to fill in orders.
  /// @param v Array ECDSA signature v parameters.
  /// @param rs Array of ECDSA signature parameters r and s tuples.
  /// @return Success of all orders being filled with respective fillValueM.
  function batchFillOrKill(
    address[2][] traders,
    address[2][] tokens,
    address[] feeRecipients,
    uint[2][] values,
    uint[2][] fees,
    uint[] expirations,
    uint[] fillValueM,
    uint8[] v,
    bytes32[2][] rs)
    returns (bool success)
  {
    for (uint i = 0; i < traders.length; i++) {
      assert(fillOrKill(
        traders[i],
        tokens[i],
        feeRecipients[i],
        values[i],
        fees[i],
        expirations[i],
        fillValueM[i],
        v[i],
        rs[i]
      ));
    }
    return true;
  }

  /// @dev Synchronously executes multiple fill orders in a single transaction until total fillValueM filled.
  /// @param traders Array of order maker and taker address tuples.
  /// @param tokens Array of order tokenM and tokenT address tuples.
  /// @param feeRecipients Array of addresses that receive order fees.
  /// @param values Array of order valueM and valueT tuples.
  /// @param fees Array of order feeM and feeT tuples.
  /// @param expirations Array of times orders expire in seconds.
  /// @param fillValueM Desired total amount of tokenM to fill in orders.
  /// @param v Array ECDSA signature v parameters.
  /// @param rs Array of ECDSA signature parameters r and s tuples.
  /// @return Total amount of fillValueM filled in orders.
  function fillUpTo(
    address[2][] traders,
    address[2][] tokens,
    address[] feeRecipients,
    uint[2][] values,
    uint[2][] fees,
    uint[] expirations,
    uint fillValueM,
    uint8[] v,
    bytes32[2][] rs)
    returns (uint filledValueM)
  {
    address tokenM = tokens[0][0];
    filledValueM = 0;
    for (uint i = 0; i < traders.length; i++) {
      if (tokenM == tokens[i][0]) {
        filledValueM = safeAdd(filledValueM, fill(
          traders[i],
          tokens[i],
          feeRecipients[i],
          values[i],
          fees[i],
          expirations[i],
          safeSub(fillValueM, filledValueM),
          v[i],
          rs[i]
        ));
        if (filledValueM == fillValueM) break;
      }
    }
    return filledValueM;
  }

  /// @dev Cancels provided amount of an order with given parameters.
  /// @param traders Array of order maker and taker addresses.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param feeRecipient Address that receives order fees.
  /// @param values Array of order valueM and valueT.
  /// @param fees Array of order feeM and feeT.
  /// @param expiration Time order expires in seconds.
  /// @param cancelValueM Desired amount of tokenM to cancel in order.
  /// @return Amount of tokenM cancelled.
  function cancel(
    address[2] traders,
    address[2] tokens,
    address feeRecipient,
    uint[2] values,
    uint[2] fees,
    uint expiration,
    uint cancelValueM)
    returns (uint cancelledValueM)
  {
    return exchange.cancel(
      traders,
      tokens,
      msg.sender,
      feeRecipient,
      values,
      fees,
      expiration,
      cancelValueM
    );
  }

  /// @dev Synchronously cancels multiple orders in a single transaction.
  /// @param traders Array of order maker and taker address tuples.
  /// @param tokens Array of order tokenM and tokenT address tuples.
  /// @param feeRecipients Array of addresses that receive order fees.
  /// @param values Array of order valueM and valueT tuples.
  /// @param fees Array of order feeM and feeT tuples.
  /// @param expirations Array of times orders expire in seconds.
  /// @param cancelValueM Array of desired amounts of tokenM to cancel in orders.
  /// @return Success if no cancels throw.
  function batchCancel(
    address[2][] traders,
    address[2][] tokens,
    address[] feeRecipients,
    uint[2][] values,
    uint[2][] fees,
    uint[] expirations,
    uint[] cancelValueM)
    returns (bool success)
  {
    for (uint i = 0; i < traders.length; i++) {
      cancel(
        traders[i],
        tokens[i],
        feeRecipients[i],
        values[i],
        fees[i],
        expirations[i],
        cancelValueM[i]
      );
    }
    return true;
  }

}
