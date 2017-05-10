pragma solidity ^0.4.8;

import "./Exchange.sol";
import "./tokens/EtherToken.sol";
import "./base/Token.sol";
import "./base/Ownable.sol";
import "./base/SafeMath.sol";

contract SimpleCrowdsale is Ownable, SafeMath {

    address public PROXY_ADDRESS;
    address public EXCHANGE_ADDRESS;
    address public PROTOCOL_TOKEN_ADDRESS;
    address public ETH_TOKEN_ADDRESS;

    Exchange exchange;
    Token protocolToken;
    EtherToken ethToken;

    bool public isInitialized;
    Order order;

    struct Order {
        address[2] traders;
        address[2] tokens;
        address feeRecipient;
        uint[2] values;
        uint[2] fees;
        uint[2] expirationAndSalt;
        uint8 v;
        bytes32[2] rs;
        bytes32 orderHash;
    }

    modifier saleInProgress() {
        assert(isInitialized && order.expirationAndSalt[0] > block.timestamp);
        _;
    }

    modifier saleNotInitialized() {
        assert(!isInitialized);
        _;
    }

    modifier validTokens(address[2] tokens) {
        assert(tokens[0] == PROTOCOL_TOKEN_ADDRESS);
        assert(tokens[1] == ETH_TOKEN_ADDRESS);
        _;
    }

    function SimpleCrowdsale(
        address _exchange,
        address _proxy,
        address _protocolToken,
        address _ethToken)
    {
        PROXY_ADDRESS = _proxy;
        EXCHANGE_ADDRESS = _exchange;
        PROTOCOL_TOKEN_ADDRESS = _protocolToken;
        ETH_TOKEN_ADDRESS = _ethToken;

        exchange = Exchange(_exchange);
        protocolToken = Token(_protocolToken);
        ethToken = EtherToken(_ethToken);
    }

    function()
        payable
        saleInProgress
    {
        uint remainingEth = safeSub(order.values[1], exchange.fills(order.orderHash));
        uint ethToFill = min(msg.value, remainingEth);
        ethToken.deposit.value(ethToFill)();
        assert(exchange.fillOrKill(
            order.traders,
            order.tokens,
            order.feeRecipient,
            order.values,
            order.fees,
            order.expirationAndSalt,
            ethToFill,
            order.v,
            order.rs
        ));
        uint filledProtocolToken = safeDiv(safeMul(order.values[0], ethToFill), order.values[1]);
        assert(protocolToken.transfer(msg.sender, filledProtocolToken));
        if (ethToFill < msg.value) {
            assert(msg.sender.send(safeSub(msg.value, ethToFill)));
        }
    }

    function init(
        address[2] traders,
        address[2] tokens,
        address feeRecipient,
        uint[2] values,
        uint[2] fees,
        uint[2] expirationAndSalt,
        uint8 v,
        bytes32[2] rs)
        saleNotInitialized
        onlyOwner
        validTokens(tokens)
    {
        order = Order({
            traders: traders,
            tokens: tokens,
            feeRecipient: feeRecipient,
            values: values,
            fees: fees,
            expirationAndSalt: expirationAndSalt,
            v: v,
            rs: rs,
            orderHash: getOrderHash(
                traders,
                tokens,
                feeRecipient,
                values,
                fees,
                expirationAndSalt
            )
        });
        assert(isValidSignature(
            traders[0],
            order.orderHash,
            v,
            rs[0],
            rs[1]
        ));
        assert(setTokenAllowance(tokens[1], values[1]));
        isInitialized = true;
    }

    function setTokenAllowance(address _token, uint _allowance)
        onlyOwner
        returns (bool success)
    {
        assert(Token(_token).approve(PROXY_ADDRESS, _allowance));
        return true;
    }

    /// @dev Calculates Keccak-256 hash of order with specified parameters.
    /// @param traders Array of order maker and taker addresses.
    /// @param tokens Array of order tokenM and tokenT addresses.
    /// @param feeRecipient Address that receives order fees.
    /// @param values Array of order valueM and valueT.
    /// @param fees Array of order feeM and feeT.
    /// @param expirationAndSalt Time order expires (seconds since unix epoch) and random number.
    /// @return Keccak-256 hash of order.
    function getOrderHash(
        address[2] traders,
        address[2] tokens,
        address feeRecipient,
        uint[2] values,
        uint[2] fees,
        uint[2] expirationAndSalt)
        constant
        returns (bytes32 orderHash)
    {
        return sha3(
            EXCHANGE_ADDRESS,
            traders[0],
            traders[1],
            tokens[0],
            tokens[1],
            feeRecipient,
            values[0],
            values[1],
            fees[0],
            fees[1],
            expirationAndSalt[0],
            expirationAndSalt[1]
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
}
