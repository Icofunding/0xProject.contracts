pragma solidity ^0.4.8;

contract ExchangeCrypto {

  /// @dev Calculates Keccak-256 hash of order with specified parameters.
  /// @param traders Array of order maker and taker addresses.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param feeRecipient Address that receives order fees.
  /// @param values Array of order valueM and valueT.
  /// @param fees Array of order feeM and feeT.
  /// @param expiration Time order expires in seconds.
  /// @return Keccak-256 hash of order.
  function getOrderHash(
    address[2] traders,
    address[2] tokens,
    address feeRecipient,
    uint[2] values,
    uint[2] fees,
    uint expiration)
    constant
    returns (bytes32 orderHash)
  {
    return sha3(
      this,
      traders[0],
      traders[1],
      tokens[0],
      tokens[1],
      feeRecipient,
      values[0],
      values[1],
      fees[0],
      fees[1],
      expiration
    );
  }

  /// @dev Verifies that an order signature is valid.
  /// @param maker Address of order maker.
  /// @param orderHash Keccak-256 hash of order.
  /// @param v ECDSA signature parameter v.
  /// @param r ECDSA signature parameters r.
  /// @param s ECDSA signature parameters s.
  /// @return Validity of order signature.
  function validSignature(
    address maker,
    bytes32 orderHash,
    uint8 v,
    bytes32 r,
    bytes32 s)
    constant
    returns (bool success)
  {
    return maker == ecrecover(
      sha3("\x19Ethereum Signed Message:\n32", orderHash),
      v,
      r,
      s
    );
  }
}
