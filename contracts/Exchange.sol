pragma solidity ^0.4.2;
import "Token.sol";
import "SafeMath.sol";

contract Exchange is SafeMath {

  address PROTOCOL_TOKEN;

  mapping (bytes32 => uint256) public fills;

  event LogClaimByUser(address indexed maker, address indexed taker, bytes32 indexed hash, address tokenA, address tokenB, uint valueA, uint valueB, uint expiration, uint amountA, uint claimedA);
  event LogClaimByToken(address maker, address taker, bytes32 hash, address indexed tokenA, address indexed tokenB, uint valueA, uint valueB, uint expiration, uint amountA, uint claimedA);
  event LogCancel(address indexed maker, bytes32 hash, address indexed tokenA, address indexed tokenB);

  struct Order {
    address signer;
    address tokenOffer;
    uint256 valueOffer;
    address tokenRequest;
    uint256 valueRequest;
    address feeRecipient;
    uint256 feeValue;
    uint256 expiration;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  // addresses = [ signer, tokenOffer, tokenRequest, feeRecipient ]
  // values = [ valueOffer, valueRequest, feeValue, expiration ]
  function fill(address[4] addresses, uint256[4] values, uint8 v, bytes32 r, bytes32 s, uint fillValue) returns(bool success) {
    Order memory order = formatOrder(addresses, values, v, r, s);
    bytes32 h = getHash(order);
    assert(validSignature(order.signer, h, v, r, s));
    assert(notExpired(order));
    assert(safeAdd(fills[h], fillValue) <= order.valueOffer);
    fills[h] = safeAdd(fills[h], fillValue);
    assert(Token(order.tokenOffer).transferFrom(order.signer, msg.sender, fillValue));
    assert(Token(order.tokenRequest).transferFrom(msg.sender, order.signer, partialFill(order, fillValue)));
    // assert(Token(PROTOCOL_TOKEN).transferFrom(order.signer, order.feeRecipient, order.feeValue));
    // assert(Token(PROTOCOL_TOKEN).transferFrom(msg.sender, order.feeRecipient, order.feeValue));
    // log events
    LogClaimByUser(addresses[0], msg.sender, h, addresses[1], addresses[2], values[0], values[1], values[3], fillValue, fills[h]);
    LogClaimByToken(addresses[0], msg.sender, h, addresses[1], addresses[2], values[0], values[1], values[3], fillValue, fills[h]);
    return true;
  }

  function cancel(address[4] addresses, uint256[4] values, uint8 v, bytes32 r, bytes32 s) returns(bool success) {
    Order memory order = formatOrder(addresses, values, v, r, s);
    bytes32 h = getHash(order);
    assert(validSignature(order.signer, h, v, r, s));
    assert(msg.sender == order.signer);
    fills[h] = order.valueOffer;
    // log events
    LogCancel(addresses[0], h, addresses[1], addresses[2]);
    return true;
  }

  // function match(order1, order2) returns(bool success) {}
  // function test() returns(bool success, string error)

  function formatOrder(address[4] addresses, uint256[4] values, uint8 _v, bytes32 _r, bytes32 _s) internal constant returns(Order) {
    return Order({
      signer: addresses[0],
      tokenOffer: addresses[1],
      tokenRequest: addresses[2],
      feeRecipient: addresses[3],
      valueOffer: values[0],
      valueRequest: values[1],
      feeValue: values[2],
      expiration: values[3],
      v: _v,
      r: _r,
      s: _s
    });
  }

  function getHash(Order order) internal constant returns(bytes32) {
    return sha3(
      this,
      order.signer,
      order.tokenOffer,
      order.valueOffer,
      order.tokenRequest,
      order.valueRequest,
      order.feeRecipient,
      order.feeValue,
      order.expiration
      );
  }

  function partialFill(Order order, uint256 fillValue) constant internal returns(uint256) {
    if (fillValue > order.valueOffer || fillValue == 0) {
      throw;
    }
    // throw if rounding error > 0.01%
    if (order.valueRequest < 10**4 && order.valueRequest*fillValue % order.valueOffer != 0) {
      throw;
    }
    return safeMul(fillValue, order.valueRequest) / order.valueOffer;
  }

  function notExpired(Order order) constant internal returns(bool) {
    return block.timestamp < order.expiration;
  }

  function validSignature(address signer, bytes32 h, uint8 v, bytes32 r, bytes32 s) constant returns(bool) {
    return signer == ecrecover(sha3("\x19Ethereum Signed Message:\n32", h), v, r, s);
    //return signer == ecrecover(h, v, r, s);
  }

  function assert(bool assertion) internal {
    if (!assertion) throw;
  }

}
