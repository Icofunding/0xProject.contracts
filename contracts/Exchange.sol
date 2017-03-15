pragma solidity ^0.4.8;

import "./tokens/Token.sol";
import "./ExchangeMathUtil.sol";
import "./Proxy.sol";
import "./ExchangeCryptoUtil.sol";

contract Exchange is ExchangeMathUtil, ExchangeCryptoUtil {

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
    uint256 fillValueM,
    uint256 remainingValueM
  );

  function Exchange(address _protocolToken, address _proxy) {
    PROTOCOL_TOKEN = _protocolToken;
    PROXY = _proxy;
  }

  /*
  * Core exchange functions
  */

  /// @dev Fills an order with specified parameters and ECDSA signature.
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
    address caller,
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
    assert(validCaller(traders[1], caller));
    if (block.timestamp < expiration) return 0;
    bytes32 orderHash = getOrderHash(
      traders,
      tokens,
      values,
      expiration
    );
    fillValueM = getFillValueM(values[0], fillValueM, fills[orderHash]);
    if (fillValueM > 0) {
      assert(validSignature(
        traders[0],
        getMsgHash(orderHash, feeRecipient, fees),
        v,
        rs[0],
        rs[1]
      ));
      assert(tradeTokens(
        traders[0],
        caller,
        tokens,
        values,
        fillValueM
      ));
      fills[orderHash] = safeAdd(fills[orderHash], fillValueM);
      assert(tradeFees(
        traders[0],
        caller,
        feeRecipient,
        values,
        fees,
        fillValueM
      ));
      LogFillEvents(
        [
          traders[0],
          caller,
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

  /*function matchOrders(
    address[2][2] traders,
    address[2] feeRecipients,
    address[2][2] tokens,
    uint256[2][2] values,
    uint256[2][2] fees,
    uint256[2] expirations,
    uint8[2] v,
    bytes32[2][2] rs)
    returns (uint256 fillValueM1, uint256 fillValueM2)
  {
    if (traders[0][1] != address(0)) {
      assert(msg.sender == traders[0][1]);
    }
    if (traders[1][1] != address(0)) {
      assert(msg.sender == traders[1][1]);
    }
    assert(isMatchable(tokens, values));
    if(block.timestamp > expirations[0] || block.timestamp > expirations[1]) return (0, 0);
    bytes32 orderHash1 = getOrderHash(
      traders[0],
      tokens[0],
      values[0],
      expirations[0]
    );
    assert(validSignature(
      traders[0][0],
      getMsgHash(orderHash1, feeRecipients[0], fees[0]),
      v[0],
      rs[0][0],
      rs[0][1]
    ));
    bytes32 orderHash2 = getOrderHash(
      traders[1],
      tokens[1],
      values[1],
      expirations[1]
    );
    assert(validSignature(
      traders[1][0],
      getMsgHash(orderHash2, feeRecipients[1], fees[1]),
      v[1],
      rs[1][0],
      rs[1][1]
    ));
    uint256 totalFillValueM = min(
      getFillValueM(values[0][0], values[0][0], fills[orderHash1]),
      getFillValueT(
        values[1][0],
        values[1][1],
        getFillValueM(values[1][1], values[1][1], fills[orderHash2])
      )
    );
    uint256 requiredFillValueM = safeDiv(
      safeMul(totalFillValueM, min(values[0][1], values[1][0])),
      max(values[0][1], values[1][0])
    );
    return (1, 1);
  }*/

  /// @dev Cancels provided amount of an order with given parameters.
  /// @param traders Array of order maker and taker addresses.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param values Array of order valueM and valueT.
  /// @param expiration Time order expires in seconds.
  /// @param fillValueM Desired amount of tokenM to cancel in order.
  /// @return Amount of tokenM cancelled.
  function cancel(
    address[2] traders,
    address caller,
    address[2] tokens,
    uint256[2] values,
    uint256 expiration,
    uint256 fillValueM)
    returns (uint256 cancelledValueM)
  {
    assert(validCaller(traders[0], caller));
    if (block.timestamp < expiration) return 0;
    bytes32 orderHash = getOrderHash(
      traders,
      tokens,
      values,
      expiration
    );
    fillValueM = getFillValueM(values[0], fillValueM, fills[orderHash]);
    if (fillValueM > 0) {
      fills[orderHash] = safeAdd(fills[orderHash], fillValueM);
      LogCancel(
        traders[0],
        tokens[0],
        tokens[1],
        values[0],
        values[1],
        expiration,
        orderHash,
        fillValueM,
        values[0] - fills[orderHash]
      );
    }
    return fillValueM;
  }

  /*
  * Constant functions
  */

  function validCaller(address required, address caller)
    constant
    returns (bool success)
  {
    assert(caller == msg.sender || caller == tx.origin);
    if (required != address(0)) assert(caller == required);
    return true;
  }

  function isMatchable(
    address[2][2] tokens,
    uint256[2][2] values
  )
    constant
    returns (bool matchable)
  {
    assert(tokens[0][0] == tokens[1][1]);
    assert(tokens[0][1] == tokens[1][0]);
    uint256 multiplier = 10**18;
    assert(safeDiv(
      safeMul(safeMul(values[0][0], values[1][0]), multiplier),
      safeMul(values[0][1], values[1][1])
    ) >= multiplier);
    return true;
  }

  /*
  * Private functions
  */

  /// @dev Transfers a token using Proxy transferFrom function.
  /// @param _token Address of token to transferFrom.
  /// @param _from Address transfering token.
  /// @param _to Address receiving token.
  /// @param _value Amount of token to transfer.
  /// @return Success of token transfer.
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

  function tradeTokens(
    address maker,
    address taker,
    address[2] tokens,
    uint256[2] values,
    uint256 fillValueM)
    private
    returns (bool success)
  {
    assert(transferFrom(
      tokens[0],
      maker,
      taker,
      fillValueM
    ));
    assert(transferFrom(
      tokens[1],
      taker,
      maker,
      getFillValueT(values[0], values[1], fillValueM)
    ));
    return true;
  }

  function tradeFees(
    address maker,
    address taker,
    address feeRecipient,
    uint256[2] values,
    uint256[2] fees,
    uint256 fillValueM)
    private
    returns (bool success)
  {
    if (feeRecipient != address(0)) {
      if (fees[0] > 0) {
        assert(transferFrom(
          PROTOCOL_TOKEN,
          maker,
          feeRecipient,
          getFeeValue(values[0], fillValueM, fees[0])
        ));
      }
      if (fees[1] > 0) {
        assert(transferFrom(
          PROTOCOL_TOKEN,
          taker,
          feeRecipient,
          getFeeValue(values[0], fillValueM, fees[1])
        ));
      }
    }
    return true;
  }

  /// @dev Logs fill events indexed by user and by token.
  /// @param addresses Array of maker, taker, tokenM, tokenT, and feeRecipient addresses.
  /// @param values Array of valueM, valueT, expiration, feeM, feeT, fillValueM, and remainingValueM.
  /// @param orderHash Keccak-256 hash of order.
  function LogFillEvents(address[5] addresses, uint256[7] values, bytes32 orderHash)
    private
    returns (bool success)
  {
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
    return true;
  }
}
