pragma solidity ^0.4.8;

import "./Proxy.sol";
import "./tokens/Token.sol";
import "./util/ExchangeMathUtil.sol";
import "./util/ExchangeCryptoUtil.sol";

contract Exchange is ExchangeMathUtil, ExchangeCryptoUtil {

  address public PROTOCOL_TOKEN;
  address public PROXY;

  mapping (bytes32 => uint) public fills;

  struct Pair {
    bytes32[2] orderHashes;
    uint[2] fillValuesM;
    uint[2] fillValuesT;
    address matcherToken;
    uint matcherValue;
  }

  modifier notExpired(uint expiration) {
    if (block.timestamp < expiration)
      _;
  }

  /*modifier callerIsControlled(address caller) {
    assert(caller == msg.sender || caller == tx.origin);
    _;
  }

  modifier callerIsMaker(address[2] traders, address caller) {
    assert(traders[0] == address(0) || caller == traders[0]);
    _;
  }

  modifier callerIsTaker(address[2] traders, address caller) {
    assert(traders[1] == address(0) || caller == traders[1]);
    _;
  }*/

  event LogFillByUser(
    address indexed maker,
    address indexed taker,
    address tokenM,
    address tokenT,
    uint valueM,
    uint valueT,
    uint expiration,
    bytes32 orderHash,
    address indexed feeRecipient,
    uint feeM,
    uint feeT,
    uint fillValueM,
    uint remainingValueM
  );

  event LogFillByToken(
    address maker,
    address taker,
    address indexed tokenM,
    address indexed tokenT,
    uint valueM,
    uint valueT,
    uint expiration,
    bytes32 indexed orderHash,
    address feeRecipient,
    uint feeM,
    uint feeT,
    uint fillValueM,
    uint remainingValueM
  );

  event LogCancel(
    address indexed maker,
    address indexed tokenM,
    address indexed tokenT,
    uint valueM,
    uint valueT,
    uint expiration,
    bytes32 orderHash,
    uint fillValueM,
    uint remainingValueM
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
    uint[2] values,
    uint[2] fees,
    uint expiration,
    uint fillValueM,
    uint8 v,
    bytes32[2] rs)
    notExpired(expiration)
    returns (uint filledValueM)
  {
    assert(validCaller(traders[1], caller));
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

  function matchOrders(
    address[2][2] traders,
    address caller,
    address[2] feeRecipients,
    address[2][2] tokens,
    uint[2][2] values,
    uint[2][2] fees,
    uint[2] expirations,
    uint8[2] v,
    bytes32[2][2] rs)
    /*notExpired(expirations[0])
    notExpired(expirations[1])*/
    returns (uint orderAFillValueM, uint orderBFillValueM)
  {
    assert(validCaller(traders[0][1], caller));
    assert(validCaller(traders[1][1], caller));
    assert(isMatchable(tokens, values));
    if(block.timestamp > expirations[0] || block.timestamp > expirations[1]) return (0, 0);
    Pair memory pair;
    pair.orderHashes = [
      getOrderHash(
        traders[0],
        tokens[0],
        values[0],
        expirations[0]
      ),
      getOrderHash(
        traders[1],
        tokens[1],
        values[1],
        expirations[1]
      )
    ];
    assert(validSignature(
      traders[0][0],
      getMsgHash(pair.orderHashes[0], feeRecipients[0], fees[0]),
      v[0],
      rs[0][0],
      rs[0][1]
    ));
    assert(validSignature(
      traders[1][0],
      getMsgHash(pair.orderHashes[1], feeRecipients[1], fees[1]),
      v[1],
      rs[1][0],
      rs[1][1]
    ));
    //initialize fillValues to remaining amounts
    pair.fillValuesM[0] = getFillValueM(values[0][0], values[0][0], fills[pair.orderHashes[0]]);
    pair.fillValuesM[1] = getFillValueM(values[1][0], values[1][0], fills[pair.orderHashes[1]]);
    pair.fillValuesT[0] = getPartialValue(values[0][0], pair.fillValuesM[0], values[0][1]);
    pair.fillValuesT[1] = getPartialValue(values[1][0], pair.fillValuesM[1], values[1][1]);
    //calculate max values to fill within order parameters
    pair.fillValuesM[0] = min(
      min(pair.fillValuesM[0], pair.fillValuesT[1]),
      safeDiv(
        safeMul(max(pair.fillValuesM[0], pair.fillValuesT[1]), min(pair.fillValuesT[0], pair.fillValuesM[1])),
        max(pair.fillValuesT[0], pair.fillValuesM[1])
      )
    );
    pair.fillValuesT[0] = getPartialValue(values[0][0], pair.fillValuesM[0], values[0][1]);
    pair.fillValuesT[1] = pair.fillValuesM[0];
    pair.fillValuesM[1] = getPartialValue(values[1][1], pair.fillValuesT[1], values[1][0]);
    assert(tradeTokens(
      traders[0][0],
      traders[1][0],
      tokens[0],
      [pair.fillValuesM[0], pair.fillValuesM[1]],
      pair.fillValuesM[0]
    ));
    return (pair.fillValuesM[0], pair.fillValuesM[1]);
  }

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
    uint[2] values,
    uint expiration,
    uint fillValueM)
    notExpired(expiration)
    returns (uint cancelledValueM)
  {
    assert(validCaller(traders[0], caller));
    //if (block.timestamp < expiration) return 0;
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

  /// @dev Checks if function is being called from a valid address.
  /// @param required Required address to call function from.
  /// @param caller Address of user or smart contract calling function.
  /// @return Caller is valid.
  function validCaller(address required, address caller)
    constant
    returns (bool success)
  {
    assert(caller == msg.sender || caller == tx.origin);
    assert(required == address(0) || caller == required);
    return true;
  }

  function isMatchable(
    address[2][2] tokens,
    uint[2][2] values
  )
    constant
    returns (bool matchable)
  {
    assert(tokens[0][0] == tokens[1][1]);
    assert(tokens[0][1] == tokens[1][0]);
    uint multiplier = 10**18;
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
    uint _value)
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
    uint[2] values,
    uint fillValueM)
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
      getPartialValue(values[0], fillValueM, values[1])
    ));
    return true;
  }

  function tradeFees(
    address maker,
    address taker,
    address feeRecipient,
    uint[2] values,
    uint[2] fees,
    uint fillValueM)
    private
    returns (bool success)
  {
    if (feeRecipient != address(0)) {
      if (fees[0] > 0) {
        assert(transferFrom(
          PROTOCOL_TOKEN,
          maker,
          feeRecipient,
          getPartialValue(values[0], fillValueM, fees[0])
        ));
      }
      if (fees[1] > 0) {
        assert(transferFrom(
          PROTOCOL_TOKEN,
          taker,
          feeRecipient,
          getPartialValue(values[0], fillValueM, fees[1])
        ));
      }
    }
    return true;
  }

  /// @dev Logs fill events indexed by user and by token.
  /// @param addresses Array of maker, taker, tokenM, tokenT, and feeRecipient addresses.
  /// @param values Array of valueM, valueT, expiration, feeM, feeT, fillValueM, and remainingValueM.
  /// @param orderHash Keccak-256 hash of order.
  function LogFillEvents(address[5] addresses, uint[7] values, bytes32 orderHash)
    private
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
  }
}
