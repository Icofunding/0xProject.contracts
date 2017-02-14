pragma solidity ^0.4.2;
import "Token.sol";
import "SafeMath.sol";

contract Exchange is SafeMath {

  address PROTOCOL_TOKEN;

  mapping (bytes32 => uint256) public fills;

  //need to rethink which params get indexed
  event LogClaimByUser(
    address indexed maker,
    address indexed taker,
    address tokenM,
    address tokenT,
    uint256 valueM,
    uint256 valueT,
    uint256 expiration,
    bytes32 hash,
    address indexed feeRecipient,
    uint256 feeM,
    uint256 feeT,
    uint256 amountM,
    uint256 claimedM
  );

  event LogClaimByToken(
    address maker,
    address taker,
    address indexed tokenM,
    address indexed tokenT,
    uint256 valueM,
    uint256 valueT,
    uint256 expiration,
    bytes32 hash,
    address feeRecipient,
    uint256 feeM,
    uint256 feeT,
    uint256 amountM,
    uint256 claimedM
  );

  event LogCancel(
    address indexed maker,
    bytes32 hash,
    address indexed tokenM,
    address indexed tokenT,
    uint cancelValue
  );

  function fill(address maker, address feeRecipient, address[2] tokens, uint256[2] values, uint256 fillValue,  uint256 expiration, uint256[2] fees, uint8 v, bytes32[2] rs) returns(bool success) {
    assert(block.timestamp < expiration);

    bytes32 orderHash = sha3(
      this,
      maker,
      tokens[0],
      tokens[1],
      values[0],
      values[1],
      expiration
    );

    assert(safeAdd(fills[orderHash], fillValue) <= values[0]);

    assert(validSignature(maker, sha3(
      orderHash,
      feeRecipient,
      fees[0],
      fees[1]
    ), v, rs[0], rs[1]));

    assert(Token(tokens[0]).transferFrom(maker, msg.sender, fillValue));
    assert(Token(tokens[1]).transferFrom(msg.sender, maker, partialFill([values[0], values[1]], fillValue)));
    assert(Token(PROTOCOL_TOKEN).transferFrom(maker, feeRecipient, fees[0]));
    assert(Token(PROTOCOL_TOKEN).transferFrom(msg.sender, feeRecipient, fees[1]));
    fills[orderHash] = safeAdd(fills[orderHash], fillValue);
    // log events
    LogEvents([maker, msg.sender, tokens[0], tokens[1], feeRecipient],
              [values[0], values[1], expiration, fees[0], fees[1], fillValue],
              orderHash
    );
    /*LogClaimByUser(maker, msg.sender, feeRecipient, orderHash, tokens[0], tokens[1], values[0], values[1], expiration, fillValue, fills[orderHash]);
    LogClaimByToken(maker, msg.sender, feeRecipient, orderHash, tokens[0], tokens[1], values[0], values[1], expiration, fillValue, fills[orderHash]);*/
    return true;
  }

  function LogEvents(address[5] addresses, uint256[6] values, bytes32 orderHash) {
    LogClaimByUser(addresses[0], addresses[1], addresses[2], addresses[3], values[0], values[1], values[2], orderHash, addresses[4], values[3], values[4], values[5], fills[orderHash]);
    LogClaimByToken(addresses[0], addresses[1], addresses[2], addresses[3], values[0], values[1], values[2], orderHash, addresses[4], values[3], values[4], values[5], fills[orderHash]);
  }
  //NOTE: local var limit not affected by addresses, but affected by uint256?
  function fill(address maker, address feeRecipient, address tokenM, address tokenT, uint256[5] values,  uint256 expiration, uint8 v, bytes32[2] rs) returns(bool success) {
    assert(block.timestamp < expiration);

    bytes32 orderHash = sha3(
      this,
      maker,
      tokenM,
      tokenT,
      values[0],
      values[1],
      expiration
    );

    assert(safeAdd(fills[orderHash], values[2]) <= values[1]);

    assert(validSignature(maker, sha3(
      orderHash,
      feeRecipient,
      values[3],
      values[4]
    ), v, rs[0], rs[1]));

    assert(Token(tokenM).transferFrom(maker, msg.sender, values[2]));
    assert(Token(tokenT).transferFrom(msg.sender, maker, partialFill([values[0], values[1]], values[2])));
    assert(Token(PROTOCOL_TOKEN).transferFrom(maker, feeRecipient, values[3]));
    assert(Token(PROTOCOL_TOKEN).transferFrom(msg.sender, feeRecipient, values[4]));
    fills[orderHash] = safeAdd(fills[orderHash], values[2]);
    // log events
    LogClaimByUser(maker, msg.sender, feeRecipient, orderHash, tokenM, tokenT, values[0], values[1], expiration, values[2], fills[orderHash]);
    LogClaimByToken(maker, msg.sender, feeRecipient, orderHash, tokenM, tokenT, values[0], values[1], expiration, values[2], fills[orderHash]);
    return true;
  }

  // addresses = [ maker, tokenM, tokenT ]
  // values = [ valueM, valueT, expiration ]
  // should you be able to cancel fee specific orders only?
  // can cancel specific signatures
  function cancel(address[3] addresses, uint256[3] values, uint256 cancelValue) returns(bool success) {
    assert(msg.sender == addresses[0]);

    bytes32 orderHash = sha3(
      this,
      addresses[0],
      addresses[1],
      addresses[2],
      values[0],
      values[1],
      values[2]
    );

    fills[orderHash] = safeAdd(fills[orderHash], cancelValue);
    // log events
    LogCancel(addresses[0], orderHash, addresses[1], addresses[2], cancelValue);
    return true;
  }
  // values = [ valueM, valueT ]
  function partialFill(uint256[2] values, uint256 fillValue) constant internal returns(uint256) {
    if (fillValue > values[0] || fillValue == 0) {
      throw;
    }
    // throw if rounding error > 0.01%
    if (values[1] < 10**4 && values[1] * fillValue % values[0] != 0) {
      throw;
    }
    return safeMul(fillValue, values[1]) / values[0];
  }

  function validSignature(address maker, bytes32 msgHash, uint8 v, bytes32 r, bytes32 s) constant returns(bool) {
    return maker == ecrecover(sha3("\x19Ethereum Signed Message:\n32", msgHash), v, r, s);
  }

  function assert(bool assertion) internal {
    if (!assertion) throw;
  }

}
