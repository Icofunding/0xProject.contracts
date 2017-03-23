pragma solidity ^0.4.8;

import "./Proxy.sol";
import "./tokens/Token.sol";
import "./util/ExchangeMath.sol";
import "./util/ExchangeCrypto.sol";

contract Exchange is ExchangeMath, ExchangeCrypto {

  address public PROTOCOL_TOKEN;
  address public PROXY;

  mapping (bytes32 => uint) public fills;

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
    uint filledValueM,
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
    uint filledValueM,
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
    uint cancelledValueM,
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
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param _caller Address to execute fill with.
  /// @param feeRecipient Address that receives order fees.
  /// @param values Array of order valueM and valueT.
  /// @param fees Array of order feeM and feeT.
  /// @param expiration Time order expires in seconds.
  /// @param _fillValueM Desired amount of tokenM to fill in order.
  /// @param v ECDSA signature parameter v.
  /// @param rs Array of ECDSA signature parameters r and s.
  /// @return Total amount of tokenM filled in trade.
  function fill(
    address[2] traders,
    address[2] tokens,
    address _caller,
    address feeRecipient,
    uint[2] values,
    uint[2] fees,
    uint expiration,
    uint _fillValueM,
    uint8 v,
    bytes32[2] rs)
    returns (uint filledValueM)
  {
    assert(isValidCaller(traders[1], _caller));
    if (block.timestamp > expiration) return 0;
    bytes32 orderHash = getOrderHash(
      traders,
      tokens,
      feeRecipient,
      values,
      fees,
      expiration
    );
    filledValueM = getFillValueM(values[0], _fillValueM, fills[orderHash]);
    if (filledValueM == 0) return 0;
    if (!isTransferable(
      [traders[0], _caller],
      tokens,
      feeRecipient,
      values,
      fees,
      filledValueM)
    ) return 0;
    assert(validSignature(
      traders[0],
      orderHash,
      v,
      rs[0],
      rs[1]
    ));
    assert(transferFrom(
      tokens[0],
      traders[0],
      _caller,
      filledValueM
    ));
    assert(transferFrom(
      tokens[1],
      _caller,
      traders[0],
      getPartialValue(values[0], filledValueM, values[1])
    ));
    fills[orderHash] = safeAdd(fills[orderHash], filledValueM);
    if (feeRecipient != address(0)) {
      if (fees[0] > 0) {
        assert(transferFrom(
          PROTOCOL_TOKEN,
          traders[0],
          feeRecipient,
          getPartialValue(values[0], filledValueM, fees[0])
        ));
      }
      if (fees[1] > 0) {
        assert(transferFrom(
          PROTOCOL_TOKEN,
          _caller,
          feeRecipient,
          getPartialValue(values[0], filledValueM, fees[1])
        ));
      }
    }
    LogFillEvents(
      [
        traders[0],
        _caller,
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
        filledValueM,
        values[0] - fills[orderHash]
      ],
      orderHash
    );
    return filledValueM;
  }

  /// @dev Cancels provided amount of an order with given parameters.
  /// @param traders Array of order maker and taker addresses.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param _caller Address to execute cancel with.
  /// @param feeRecipient Address that receives order fees.
  /// @param values Array of order valueM and valueT.
  /// @param fees Array of order feeM and feeT.
  /// @param expiration Time order expires in seconds.
  /// @param _cancelValueM Desired amount of tokenM to cancel in order.
  /// @return Amount of tokenM cancelled.
  function cancel(
    address[2] traders,
    address[2] tokens,
    address _caller,
    address feeRecipient,
    uint[2] values,
    uint[2] fees,
    uint expiration,
    uint _cancelValueM)
    returns (uint cancelledValueM)
  {
    assert(isValidCaller(traders[0], _caller));
    if (block.timestamp > expiration) return 0;
    bytes32 orderHash = getOrderHash(
      traders,
      tokens,
      feeRecipient,
      values,
      fees,
      expiration
    );
    cancelledValueM = getFillValueM(values[0], _cancelValueM, fills[orderHash]);
    if (cancelledValueM == 0) return 0;
    fills[orderHash] = safeAdd(fills[orderHash], cancelledValueM);
    LogCancel(
      traders[0],
      tokens[0],
      tokens[1],
      values[0],
      values[1],
      expiration,
      orderHash,
      cancelledValueM,
      values[0] - fills[orderHash]
    );
    return cancelledValueM;
  }

  /*
  * Constant functions
  */

  /// @dev Checks if function is being called from a valid address.
  /// @param _required Required address to call function from.
  /// @param _caller Address of user or smart contract calling function.
  /// @return Caller is valid.
  function isValidCaller(address _required, address _caller)
    constant
    returns (bool success)
  {
    assert(_caller == msg.sender || _caller == tx.origin);
    assert(_required == address(0) || _caller == _required);
    return true;
  }

  /// @dev Predicts if any order transfers will fail.
  /// @param traders Array of maker and caller addresses.
  /// @param tokens Array of order tokenM and tokenT addresses.
  /// @param feeRecipient Address that receives order fees.
  /// @param values Array of order valueM and valueT.
  /// @param fees Array of order feeM and feeT.
  /// @param _fillValueM Amount of tokenM to be filled in order.
  /// @return Predicted result of transfers.
  function isTransferable(
    address[2] traders,
    address[2] tokens,
    address feeRecipient,
    uint[2] values,
    uint[2] fees,
    uint _fillValueM)
    constant
    returns (bool transferable)
  {
    uint fillValueT = getPartialValue(values[0], _fillValueM, values[1]);
    if (
      getBalance(tokens[0], traders[0]) < _fillValueM ||
      getAllowance(tokens[0], traders[0]) < _fillValueM ||
      getBalance(tokens[1], traders[1]) < fillValueT ||
      getAllowance(tokens[1], traders[1]) < fillValueT
    ) return false;
    if (feeRecipient != address(0)) {
      uint feeValueM = getPartialValue(values[0], _fillValueM, fees[0]);
      uint feeValueT = getPartialValue(values[0], _fillValueM, fees[1]);
      if (
        getBalance(PROTOCOL_TOKEN, traders[0]) < feeValueM ||
        getAllowance(PROTOCOL_TOKEN, traders[0]) < feeValueM ||
        getBalance(PROTOCOL_TOKEN, traders[1]) < feeValueT ||
        getAllowance(PROTOCOL_TOKEN, traders[1]) < feeValueT
      ) return false;
    }
    return true;
  }

  /// @dev Get token balance of an address.
  /// @param _token Address of token.
  /// @param _owner Address of owner.
  /// @return Token balance of owner.
  function getBalance(address _token, address _owner)
    constant
    returns (uint balance)
  {
    return Token(_token).balanceOf(_owner);
  }

  /// @dev Get allowance of token given to Proxy by an address.
  /// @param _token Address of token.
  /// @param _owner Address of owner.
  /// @return Allowance of token given to Proxy by owner.
  function getAllowance(address _token, address _owner)
    constant
    returns (uint allowance)
  {
    return Token(_token).allowance(_owner, PROXY);
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
