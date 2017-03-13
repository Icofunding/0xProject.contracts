pragma solidity ^0.4.8;

import "./tokens/Token.sol";
import "./SafeMath.sol";
import "./Proxy.sol";

contract Exchange is SafeMath {

  address public PROTOCOL_TOKEN;
  address public PROXY;

  mapping (bytes32 => uint256) public fills;

  event LogFillByUser(
    address indexed maker,
    address indexed taker,
    address tokenM,
    address tokenT,
    uint256 valueM,
    uint256 valueT,
    uint256 expiration,
    bytes32 orderHash,
    address indexed feeRecipient,
    uint256 feeM,
    uint256 feeT,
    uint256 fillValueM,
    uint256 remainingValueM
  );

  event LogFillByToken(
    address maker,
    address taker,
    address indexed tokenM,
    address indexed tokenT,
    uint256 valueM,
    uint256 valueT,
    uint256 expiration,
    bytes32 indexed orderHash,
    address feeRecipient,
    uint256 feeM,
    uint256 feeT,
    uint256 fillValueM,
    uint256 remainingValueM
  );

  event LogCancel(
    address indexed maker,
    address indexed tokenM,
    address indexed tokenT,
    uint256 valueM,
    uint256 valueT,
    uint256 expiration,
    bytes32 orderHash,
    uint256 cancelValueM,
    uint256 remainingValueM
  );

  function Exchange(address _protocolToken, address _proxy) {
    PROTOCOL_TOKEN = _protocolToken;
    PROXY = _proxy;
  }

  //traders = [maker, taker]
  //tokens = [tokenM, tokenT]
  //values = [valueM, valueT]
  //fees = [feeM, feeT]
  //rs = [r, s]
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
    assert(block.timestamp < expiration);
    if (traders[1] != address(0)) {
      assert(traders[1] == msg.sender);
    }
    bytes32 orderHash = getOrderHash(
      traders,
      tokens,
      values,
      expiration
    );
    if (safeAdd(fills[orderHash], fillValueM) > values[0]) {
      fillValueM = safeSub(values[0], fills[orderHash]);
    }
    if (fillValueM > 0) {
      assert(validSignature(
        traders[0],
        getMsgHash(orderHash, feeRecipient, fees),
        v,
        rs[0],
        rs[1]
      ));
      assert(transferFrom(
        tokens[0],
        traders[0],
        msg.sender,
        fillValueM
      ));
      assert(transferFrom(
        tokens[1],
        msg.sender,
        traders[0],
        getFillValueT(values[0], values[1], fillValueM)
      ));
      fills[orderHash] = safeAdd(fills[orderHash], fillValueM);
      if (feeRecipient != address(0)) {
        if (fees[0] > 0) {
          assert(transferFrom(
            PROTOCOL_TOKEN,
            traders[0],
            feeRecipient,
            getFeeValue(values[0], fillValueM, fees[0])
          ));
        }
        if (fees[1] > 0) {
          assert(transferFrom(
            PROTOCOL_TOKEN,
            msg.sender,
            feeRecipient,
            getFeeValue(values[0], fillValueM, fees[1])
          ));
        }
      }
      // log events
      LogFillEvents(
        [
          traders[0],
          msg.sender,
          tokens[0],
          tokens[1],
          feeRecipient
        ],
        [
          values[0],
          values[1],
          expiration,
          fees[0],
          fees[1],
          fillValueM,
          values[0] - fills[orderHash]
        ],
        orderHash
      );
    }
    return fillValueM;
  }

  //batch fills array of orders, throws if any fills amounts are not as predicted
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
      assert(fill(
        traders[i],
        feeRecipients[i],
        tokens[i],
        values[i],
        fees[i],
        expirations[i],
        fillValuesM[i],
        v[i],
        rs[i]
      ) == fillValuesM[i]);
    }
    return true;
  }

  //fills array of orders until entire fillValueM filled
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
    returns (uint256 fillValueMLeft)
  {
    address tokenM = tokens[0][0];
    for (uint256 i = 0; i < traders.length; i++) {
      assert(tokenM == tokens[i][0]);
      fillValueM = safeSub(fillValueM, fill(
        traders[i],
        feeRecipients[i],
        tokens[i],
        values[i],
        fees[i],
        expirations[i],
        fillValueM,
        v[i],
        rs[i]
      ));
      if (fillValueM == 0) break;
    }
    return fillValueM;
  }

  function cancel(
    address[2] traders,
    address[2] tokens,
    uint256[2] values,
    uint256 expiration,
    uint256 cancelValueM)
    returns (bool success)
  {
    assert(msg.sender == traders[0]);
    assert(cancelValueM > 0);
    bytes32 orderHash = getOrderHash(
      traders,
      tokens,
      values,
      expiration
    );
    // NOTE: check that fills[orderHash] + cancelValue <= valueM
    fills[orderHash] = safeAdd(fills[orderHash], cancelValueM);
    LogCancel(
      traders[0],
      tokens[0],
      tokens[1],
      values[0],
      values[1],
      expiration,
      orderHash,
      cancelValueM,
      values[0] - fills[orderHash]
    );
    return true;
  }

  function batchCancel(
    address[2][] traders,
    address[2][] tokens,
    uint256[2][] values,
    uint256[] expirations,
    uint256[] cancelValuesM)
    returns (bool success)
  {
    for (uint256 i = 0; i < traders.length; i++) {
      assert(cancel(
        traders[i],
        tokens[i],
        values[i],
        expirations[i],
        cancelValuesM[i]
      ));
      return true;
    }
  }

  //addresses = [maker, taker, tokenM, tokenT, feeRecipient]
  //values = [valueM, valueT, expiration, feeM, feeT, fillValueM, remainingValueM]
  function LogFillEvents(address[5] addresses, uint256[7] values, bytes32 orderHash) {
    LogFillByUser(
      addresses[0],
      addresses[1],
      addresses[2],
      addresses[3],
      values[0],
      values[1],
      values[2],
      orderHash,
      addresses[4],
      values[3],
      values[4],
      values[5],
      values[6]
    );
    LogFillByToken(
      addresses[0],
      addresses[1],
      addresses[2],
      addresses[3],
      values[0],
      values[1],
      values[2],
      orderHash,
      addresses[4],
      values[3],
      values[4],
      values[5],
      values[6]
    );
  }

  function getFillValueT(uint256 valueM, uint256 valueT, uint256 fillValueM)
    constant
    internal
    returns (uint256 fillValueT)
  {
    assert(fillValueM <= valueM);
    assert(!(valueT < 10**4 && valueT * fillValueM % valueM != 0)); // throw if rounding error > 0.01%
    return safeMul(fillValueM, valueT) / valueM;
  }

  function getFeeValue(uint256 valueM, uint256 fillValueM, uint256 fee)
    constant
    internal
    returns (uint256 feeValue)
  {
    return safeDiv(safeMul(fee, fillValueM), valueM);
  }

  function getOrderHash(
    address[2] traders,
    address[2] tokens,
    uint256[2] values,
    uint256 expiration)
    constant
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

  function getMsgHash(bytes32 orderHash, address feeRecipient, uint256[2] fees)
    constant
    returns (bytes32 msgHash)
  {
    return sha3(
      orderHash,
      feeRecipient,
      fees[0],
      fees[1]
    );
  }

  function validSignature(
    address maker,
    bytes32 msgHash,
    uint8 v,
    bytes32 r,
    bytes32 s)
    constant
    returns (bool success)
  {
    return maker == ecrecover(
      sha3("\x19Ethereum Signed Message:\n32", msgHash),
      v,
      r,
      s
    );
  }

  function transferFrom(
    address _token,
    address _from,
    address _to,
    uint256 _value)
    private
    returns (bool success)
  {
    return Proxy(PROXY).transferFrom(
      _token,
      _from,
      _to,
      _value
    );
  }

}
