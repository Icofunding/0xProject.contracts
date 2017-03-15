pragma solidity ^0.4.8;

contract ExchangeCryptoUtil {

  /// @dev Calculates Keccak-256 hash of order with specified parameters.
  /// @param traders Array of order maker and taker addresses.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param values Array of order valueM and valueT.
  /// @param expiration Time order expires in seconds.
  /// @return Keccak-256 hash of order.
  function getOrderHash(
    address[2] traders,
    address[2] tokens,
    uint256[2] values,
    uint256 expiration)
    constant
    internal
    returns (bytes32 orderHash)
  {
    return sha3(
      this,
      traders[0],
      traders[1],
      tokens[0],
      tokens[1],
      values[0],
      values[1],
      expiration
    );
  }

  /// @dev Calculates hash of data signed by maker.
  /// @param orderHash Keccak-256 hash of order.
  /// @param feeRecipient Address that receives order fees.
  /// @param fees Array of order feeM and feeT.
  /// @return Keccak-256 hash of orderHash and fee data.
  function getMsgHash(bytes32 orderHash, address feeRecipient, uint256[2] fees)
    constant
    internal
    returns (bytes32 msgHash)
  {
    return sha3(
      orderHash,
      feeRecipient,
      fees[0],
      fees[1]
    );
  }

  /// @dev Verifies that an order signature is valid.
  /// @param maker Address of order maker.
  /// @param msgHash Keccak-256 hash of orderHash and fee data.
  /// @param v ECDSA signature parameter v.
  /// @param r ECDSA signature parameters r.
  /// @param s ECDSA signature parameters s.
  /// @return Validity of order signature.
  function validSignature(
    address maker,
    bytes32 msgHash,
    uint8 v,
    bytes32 r,
    bytes32 s)
    constant
    internal
    returns (bool success)
  {
    return maker == ecrecover(
      sha3("\x19Ethereum Signed Message:\n32", msgHash),
      v,
      r,
      s
    );
  }
}
