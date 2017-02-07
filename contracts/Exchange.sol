pragma solidity ^0.4.2;
import "Token.sol";
import "SafeMath.sol";

contract Exchange is SafeMath {

  address PROTOCOL_TOKEN;

  mapping (bytes32 => uint256) public fills;

  //need to rethink which params get indexed
  event LogClaimByUser(address indexed maker, address indexed taker, bytes32 indexed hash, address tokenM, address tokenT, uint valueM, uint valueT, uint expiration, uint amountM, uint claimedM);
  event LogClaimByToken(address maker, address taker, bytes32 indexed hash, address indexed tokenM, address indexed tokenT, uint valueM, uint valueT, uint expiration, uint amountM, uint claimedM);
  event LogCancel(address indexed maker, bytes32 hash, address indexed tokenM, address indexed tokenT, uint cancelValue);

  // addresses = [ maker, tokenM, tokenT, feeRecipient ]
  // values = [ valueM, valueT, expiration, feeM, feeT ]
  // why isn't fillValue uint256?
  function fill(address[4] addresses, uint256[5] values, uint8 v, bytes32 r, bytes32 s, uint fillValue) returns(bool success) {
    assert(block.timestamp < values[2]);

    bytes32 orderHash = sha3(
      this,
      addresses[0],
      addresses[1],
      addresses[2],
      values[0],
      values[1],
      values[2]
    );

    assert(safeAdd(fills[orderHash], fillValue) <= values[0]);

    bytes32 msgHash = sha3(
      orderHash,
      addresses[3],
      values[3],
      values[4]
    );

    assert(validSignature(addresses[0], msgHash, v, r, s));

    assert(Token(addresses[1]).transferFrom(addresses[0], msg.sender, fillValue));
    assert(Token(addresses[2]).transferFrom(msg.sender, addresses[0], partialFill([values[0], values[1]], fillValue)));
    assert(Token(PROTOCOL_TOKEN).transferFrom(addresses[0], addresses[3], values[3]));
    assert(Token(PROTOCOL_TOKEN).transferFrom(msg.sender, addresses[3], values[4]));
    fills[orderHash] = safeAdd(fills[orderHash], fillValue);
    // log events
    LogClaimByUser(addresses[0], msg.sender, orderHash, addresses[1], addresses[2], values[0], values[1], values[3], fillValue, fills[orderHash]);
    LogClaimByToken(addresses[0], msg.sender, orderHash, addresses[1], addresses[2], values[0], values[1], values[3], fillValue, fills[orderHash]);
    return true;
  }

  // addresses = [ maker, tokenM, tokenT ]
  // values = [ valueM, valueT, expiration ]
  // should you be able to cancel fee specific orders only?
  function cancel(address[3] addresses, uint256[3] values, uint cancelValue) returns(bool success) {
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
