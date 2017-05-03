/*

  Copyright 2017 ZeroEx Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/
pragma solidity ^0.4.8;

import "./Proxy.sol";
import "./base/Token.sol";
import "./base/SafeMath.sol";

/// @title Exchange - Facilitates exchange of ERC20 tokens.
/// @author Amir Bandeali - <amir@0xProject.com>, Will Warren - <will@0xProject.com>
contract Exchange is SafeMath {

    // Error Codes
    uint8 constant ERROR_FILL_EXPIRED = 0;           // Order has already expired
    uint8 constant ERROR_FILL_NO_VALUE = 1;          // Order has already been fully filled or cancelled
    uint8 constant ERROR_FILL_TRUNCATION = 2;        // Rounding error too large
    uint8 constant ERROR_FILL_BALANCE_ALLOWANCE = 3; // Insufficient balance or allowance for token transfer
    uint8 constant ERROR_CANCEL_EXPIRED = 4;         // Order has already expired
    uint8 constant ERROR_CANCEL_NO_VALUE = 5;        // Order has already been fully filled or cancelled

    address public PROTOCOL_TOKEN;
    address public PROXY;

    mapping (bytes32 => uint) public fills;

    event LogFill(
        address indexed maker,
        address taker,
        address indexed feeRecipient,
        address tokenM,
        address tokenT,
        uint valueM,
        uint valueT,
        uint feeM,
        uint feeT,
        uint expiration,
        uint filledValueT,
        bytes32 indexed tokens,
        bytes32 orderHash
    );

    event LogCancel(
        address indexed maker,
        address indexed feeRecipient,
        address tokenM,
        address tokenT,
        uint valueM,
        uint valueT,
        uint feeM,
        uint feeT,
        uint expiration,
        uint cancelledValueT,
        bytes32 indexed tokens,
        bytes32 orderHash
    );

    event LogError(uint8 indexed errorId, bytes32 indexed orderHash);

    function Exchange(address _protocolToken, address _proxy) {
        PROTOCOL_TOKEN = _protocolToken;
        PROXY = _proxy;
    }

    /*
    * Core exchange functions
    */

    /// @dev Fills the input order.
    /// @param traders Array of order maker and taker (optional) addresses.
    /// @param tokens Array of ERC20 token addresses [tokenM, tokenT].
    /// @param feeRecipient Address that receives order fees.
    /// @param shouldCheckTransfer Test if transfer will fail before attempting.
    /// @param values Token values to be traded [valueM, valueT].
    /// @param fees Array of order feeM and feeT.
    /// @param expiration Time order expires (seconds since unix epoch).
    /// @param fillValueT Desired amount of tokenT to fill.
    /// @param v ECDSA signature parameter v.
    /// @param rs Array of ECDSA signature parameters r and s.
    /// @return Total amount of tokenM filled in trade.
    function fill(
        address[2] traders,
        address[2] tokens,
        address feeRecipient,
        bool shouldCheckTransfer,
        uint[2] values,
        uint[2] fees,
        uint expiration,
        uint fillValueT,
        uint8 v,
        bytes32[2] rs)
        returns (uint filledValueT)
    {
        assert(traders[1] == address(0) || traders[1] == msg.sender);

        bytes32 orderHash = getOrderHash(
            traders,
            tokens,
            feeRecipient,
            values,
            fees,
            expiration
        );

        if (block.timestamp >= expiration) {
            LogError(ERROR_FILL_EXPIRED, orderHash);
            return 0;
        }

        filledValueT = min(fillValueT, safeSub(values[1], fills[orderHash]));
        if (filledValueT == 0) {
            LogError(ERROR_FILL_NO_VALUE, orderHash);
            return 0;
        }

        if (isRoundingError(values[1], filledValueT, values[0])) {
            LogError(ERROR_FILL_TRUNCATION, orderHash);
            return 0;
        }

        if (shouldCheckTransfer && !isTransferable(
            [traders[0], msg.sender],
            tokens,
            feeRecipient,
            values,
            fees,
            filledValueT
        )) {
            LogError(ERROR_FILL_BALANCE_ALLOWANCE, orderHash);
            return 0;
        }

        assert(isValidSignature(
            traders[0],
            orderHash,
            v,
            rs[0],
            rs[1]
        ));

        fills[orderHash] = safeAdd(fills[orderHash], filledValueT);
        assert(transferViaProxy(
            tokens[0],
            traders[0],
            msg.sender,
            getPartialValue(values[1], filledValueT, values[0])
        ));
        assert(transferViaProxy(
            tokens[1],
            msg.sender,
            traders[0],
            filledValueT
        ));

        if (feeRecipient != address(0)) {
            if (fees[0] > 0) {
                assert(transferViaProxy(
                    PROTOCOL_TOKEN,
                    traders[0],
                    feeRecipient,
                    getPartialValue(values[1], filledValueT, fees[0])
                ));
            }
            if (fees[1] > 0) {
                assert(transferViaProxy(
                    PROTOCOL_TOKEN,
                    msg.sender,
                    feeRecipient,
                    getPartialValue(values[1], filledValueT, fees[1])
                ));
            }
        }
        assert(fills[orderHash] <= values[1]);

        fillSuccess(
            [traders[0], msg.sender],
            tokens,
            feeRecipient,
            values,
            fees,
            expiration,
            filledValueT,
            orderHash
        );
        return filledValueT;
    }

    /// @dev Cancels the input order.
    /// @param traders Array of order maker and taker addresses.
    /// @param tokens Array of ERC20 token addresses [tokenM, tokenT].
    /// @param feeRecipient Address that receives order fees.
    /// @param values Array of order valueM and valueT.
    /// @param fees Array of order feeM and feeT.
    /// @param expiration Time order expires in seconds.
    /// @param cancelValueT Desired amount of tokenT to cancel in order.
    /// @return Amount of tokenM cancelled.
    function cancel(
        address[2] traders,
        address[2] tokens,
        address feeRecipient,
        uint[2] values,
        uint[2] fees,
        uint expiration,
        uint cancelValueT)
        returns (uint cancelledValueT)
    {
        assert(traders[0] == msg.sender);

        bytes32 orderHash = getOrderHash(
            traders,
            tokens,
            feeRecipient,
            values,
            fees,
            expiration
        );

        if (block.timestamp >= expiration) {
            LogError(ERROR_CANCEL_EXPIRED, orderHash);
            return 0;
        }

        cancelledValueT = min(cancelValueT, safeSub(values[1], fills[orderHash]));
        if (cancelledValueT == 0) {
            LogError(ERROR_CANCEL_NO_VALUE, orderHash);
            return 0;
        }

        fills[orderHash] = safeAdd(fills[orderHash], cancelledValueT);

        cancelSuccess(
            traders[0],
            tokens,
            feeRecipient,
            values,
            fees,
            expiration,
            cancelledValueT,
            orderHash
        );
        return cancelledValueT;
    }

    /*
    * Wrapper functions
    */

    /// @dev Fills an order with specified parameters and ECDSA signature, throws if specified amount not filled entirely.
    /// @param traders Array of order maker and taker addresses.
    /// @param tokens Array of order tokenM and tokenT addresses.
    /// @param feeRecipient Address that receives order fees.
    /// @param values Array of order valueM and valueT.
    /// @param fees Array of order feeM and feeT.
    /// @param expiration Time order expires in seconds.
    /// @param fillValueT Desired amount of tokenT to fill in order.
    /// @param v ECDSA signature parameter v.
    /// @param rs Array of ECDSA signature parameters r and s.
    /// @return Success of entire fillValueT being filled.
    function fillOrKill(
        address[2] traders,
        address[2] tokens,
        address feeRecipient,
        uint[2] values,
        uint[2] fees,
        uint expiration,
        uint fillValueT,
        uint8 v,
        bytes32[2] rs)
        returns (bool success)
    {
        assert(fill(
            traders,
            tokens,
            feeRecipient,
            false,
            values,
            fees,
            expiration,
            fillValueT,
            v,
            rs
        ) == fillValueT);
        return true;
    }

    /// @dev Synchronously executes multiple fill orders in a single transaction.
    /// @param traders Array of order maker and taker address tuples.
    /// @param tokens Array of order tokenM and tokenT address tuples.
    /// @param feeRecipients Array of addresses that receive order fees.
    /// @param values Array of order valueM and valueT tuples.
    /// @param fees Array of order feeM and feeT tuples.
    /// @param expirations Array of times orders expire in seconds.
    /// @param fillValuesT Array of desired amounts of tokenT to fill in orders.
    /// @param v Array ECDSA signature v parameters.
    /// @param rs Array of ECDSA signature parameters r and s tuples.
    /// @param shouldCheckTransfer Test if transfers will fail before attempting.
    /// @return True if no fills throw.
    function batchFill(
        address[2][] traders,
        address[2][] tokens,
        address[] feeRecipients,
        bool shouldCheckTransfer,
        uint[2][] values,
        uint[2][] fees,
        uint[] expirations,
        uint[] fillValuesT,
        uint8[] v,
        bytes32[2][] rs)
        returns (bool success)
    {
        for (uint i = 0; i < traders.length; i++) {
            fill(
                traders[i],
                tokens[i],
                feeRecipients[i],
                shouldCheckTransfer,
                values[i],
                fees[i],
                expirations[i],
                fillValuesT[i],
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
    /// @param fillValuesT Array of desired amounts of tokenT to fill in orders.
    /// @param v Array ECDSA signature v parameters.
    /// @param rs Array of ECDSA signature parameters r and s tuples.
    /// @return Success of all orders being filled with respective fillValueT.
    function batchFillOrKill(
        address[2][] traders,
        address[2][] tokens,
        address[] feeRecipients,
        uint[2][] values,
        uint[2][] fees,
        uint[] expirations,
        uint[] fillValuesT,
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
                fillValuesT[i],
                v[i],
                rs[i]
            ));
        }
        return true;
    }

    /// @dev Synchronously executes multiple fill orders in a single transaction until total fillValueT filled.
    /// @param traders Array of order maker and taker address tuples.
    /// @param tokens Array of order tokenM and tokenT address tuples.
    /// @param feeRecipients Array of addresses that receive order fees.
    /// @param values Array of order valueM and valueT tuples.
    /// @param fees Array of order feeM and feeT tuples.
    /// @param expirations Array of times orders expire in seconds.
    /// @param fillValueT Desired total amount of tokenT to fill in orders.
    /// @param v Array ECDSA signature v parameters.
    /// @param rs Array of ECDSA signature parameters r and s tuples.
    /// @param shouldCheckTransfer Test if transfers will fail before attempting.
    /// @return Total amount of fillValueT filled in orders.
    function fillUpTo(
        address[2][] traders,
        address[2][] tokens,
        address[] feeRecipients,
        bool shouldCheckTransfer,
        uint[2][] values,
        uint[2][] fees,
        uint[] expirations,
        uint fillValueT,
        uint8[] v,
        bytes32[2][] rs)
        returns (uint filledValueT)
    {
        filledValueT = 0;
        for (uint i = 0; i < traders.length; i++) {
            assert(tokens[i][1] == tokens[0][1]);
            filledValueT = safeAdd(filledValueT, fill(
                traders[i],
                tokens[i],
                feeRecipients[i],
                shouldCheckTransfer,
                values[i],
                fees[i],
                expirations[i],
                safeSub(fillValueT, filledValueT),
                v[i],
                rs[i]
            ));
            if (filledValueT == fillValueT) break;
        }
        return filledValueT;
    }

    /// @dev Synchronously cancels multiple orders in a single transaction.
    /// @param traders Array of order maker and taker address tuples.
    /// @param tokens Array of order tokenM and tokenT address tuples.
    /// @param feeRecipients Array of addresses that receive order fees.
    /// @param values Array of order valueM and valueT tuples.
    /// @param fees Array of order feeM and feeT tuples.
    /// @param expirations Array of times orders expire in seconds.
    /// @param cancelValuesT Array of desired amounts of tokenT to cancel in orders.
    /// @return Success if no cancels throw.
    function batchCancel(
        address[2][] traders,
        address[2][] tokens,
        address[] feeRecipients,
        uint[2][] values,
        uint[2][] fees,
        uint[] expirations,
        uint[] cancelValuesT)
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
                cancelValuesT[i]
            );
        }
        return true;
    }

    /*
    * Constant public functions
    */

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
    /// @param pubKey Public address of signer.
    /// @param hash Signed Keccak-256 hash.
    /// @param v ECDSA signature parameter v.
    /// @param r ECDSA signature parameters r.
    /// @param s ECDSA signature parameters s.
    /// @return Validity of order signature.
    function isValidSignature(
        address pubKey,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s)
        constant
        returns (bool isValid)
    {
        return pubKey == ecrecover(
            sha3("\x19Ethereum Signed Message:\n32", hash),
            v,
            r,
            s
        );
    }

    /// @dev Calculates minimum of two values.
    /// @param a First value.
    /// @param b Second value.
    /// @return Minimum of values.
    function min(uint a, uint b)
        constant
        returns (uint min)
    {
        if (a < b) return a;
        return b;
    }

    /// @dev Checks if rounding error > 0.1%.
    /// @param denominator Denominator
    /// @param numerator Numerator
    /// @param target Value to multiply with numerator/denominator.
    /// @return Rounding error is present
    function isRoundingError(uint denominator, uint numerator, uint target)
        constant
        returns (bool isError)
    {
        return (target < 10**3 && mulmod(target, numerator, denominator) != 0);
    }

    /// @dev Calculates partial value given a fillValue and a corresponding total value.
    /// @param value Amount of token specified in order.
    /// @param fillValue Amount of token to be filled.
    /// @param target Value to calculate partial.
    /// @return Partial value of target.
    function getPartialValue(uint value, uint fillValue, uint target)
        constant
        returns (uint partialValue)
    {
        return safeDiv(safeMul(fillValue, target), value);
    }

    /*
    * Private functions
    */

    /// @dev Transfers a token using Proxy transferFrom function.
    /// @param token Address of token to transferFrom.
    /// @param from Address transfering token.
    /// @param to Address receiving token.
    /// @param value Amount of token to transfer.
    /// @return Success of token transfer.
    function transferViaProxy(
        address token,
        address from,
        address to,
        uint value)
        private
        returns (bool success)
    {
        return Proxy(PROXY).transferFrom(token, from, to, value);
    }

    /// @dev Logs fill event.
    /// @param traders Array of order maker and caller of fill.
    /// @param tokens Array of order tokenM and tokenT addresses.
    /// @param feeRecipient Address that receives order fees.
    /// @param values Array of order valueM and valueT.
    /// @param fees Array of order feeM and feeT.
    /// @param expiration Time order expires in seconds.
    /// @param filledValueM Value of tokenM to filled transaction.
    /// @param orderHash Keccak-256 hash of order.
    /// @return Value of tokenM filled in transaction.
    function fillSuccess(
        address[2] traders,
        address[2] tokens,
        address feeRecipient,
        uint[2] values,
        uint[2] fees,
        uint expiration,
        uint filledValueM,
        bytes32 orderHash)
        private
    {
        LogFill(
            traders[0],
            traders[1],
            feeRecipient,
            tokens[0],
            tokens[1],
            values[0],
            values[1],
            fees[0],
            fees[1],
            expiration,
            filledValueM,
            sha3(tokens[0], tokens[1]),
            orderHash
        );
    }

    /// @dev Logs cancel event.
    /// @param maker Address of order maker.
    /// @param tokens Array of order tokenM and tokenT addresses.
    /// @param feeRecipient Address that receives order fees.
    /// @param values Array of order valueM and valueT.
    /// @param fees Array of order feeM and feeT.
    /// @param expiration Time order expires in seconds.
    /// @param cancelledValueM Value of tokenM cancelled in transaction.
    /// @param orderHash Keccak-256 hash of order.
    /// @return Value of tokenM cancelled in transaction.
    function cancelSuccess(
        address maker,
        address[2] tokens,
        address feeRecipient,
        uint[2] values,
        uint[2] fees,
        uint expiration,
        uint cancelledValueM,
        bytes32 orderHash)
        private
    {
        LogCancel(
            maker,
            feeRecipient,
            tokens[0],
            tokens[1],
            values[0],
            values[1],
            fees[0],
            fees[1],
            expiration,
            cancelledValueM,
            sha3(tokens[0], tokens[1]),
            orderHash
        );
    }

    /// @dev Checks if any order transfers will fail.
    /// @param traders Array of maker and taker addresses.
    /// @param tokens Array of tokenM and tokenT addresses.
    /// @param feeRecipient Address that receives order fees.
    /// @param values Array of order valueM and valueT.
    /// @param fees Array of order feeM and feeT.
    /// @param fillValueT Amount of tokenT to be filled in order.
    /// @return Predicted result of transfers.
    function isTransferable(
        address[2] traders,
        address[2] tokens,
        address feeRecipient,
        uint[2] values,
        uint[2] fees,
        uint fillValueT)
        private
        constant
        returns (bool isTransferable)
    {
        uint fillValueM = getPartialValue(values[1], fillValueT, values[0]);
        if (   getBalance(tokens[0], traders[0]) < fillValueM
            || getAllowance(tokens[0], traders[0]) < fillValueM
            || getBalance(tokens[1], traders[1]) < fillValueT
            || getAllowance(tokens[1], traders[1]) < fillValueT
        ) return false;
        if (feeRecipient != address(0)) {
            uint feeValueM = getPartialValue(values[1], fillValueT, fees[0]);
            uint feeValueT = getPartialValue(values[1], fillValueT, fees[1]);
            if (   getBalance(PROTOCOL_TOKEN, traders[0]) < feeValueM
                || getAllowance(PROTOCOL_TOKEN, traders[0]) < feeValueM
                || getBalance(PROTOCOL_TOKEN, traders[1]) < feeValueT
                || getAllowance(PROTOCOL_TOKEN, traders[1]) < feeValueT
            ) return false;
        }
        return true;
    }

    /// @dev Get token balance of an address.
    /// @param token Address of token.
    /// @param owner Address of owner.
    /// @return Token balance of owner.
    function getBalance(address token, address owner)
        private
        constant
        returns (uint balance)
    {
        return Token(token).balanceOf(owner);
    }

    /// @dev Get allowance of token given to Proxy by an address.
    /// @param token Address of token.
    /// @param owner Address of owner.
    /// @return Allowance of token given to Proxy by owner.
    function getAllowance(address token, address owner)
        private
        constant
        returns (uint allowance)
    {
        return Token(token).allowance(owner, PROXY);
    }
}
