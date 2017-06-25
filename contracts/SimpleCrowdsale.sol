pragma solidity ^0.4.11;

import "./Exchange.sol";
import "./tokens/EtherToken.sol";
import "./base/Token.sol";
import "./base/Ownable.sol";
import "./base/SafeMath.sol";

contract SimpleCrowdsale is Ownable, SafeMath {

    event Initialized(
        address maker,
        address taker,
        address makerToken,
        address takerToken,
        address feeRecipient,
        uint makerTokenAmount,
        uint takerTokenAmount,
        uint makerFee,
        uint takerFee,
        uint expirationTimestampInSec,
        uint salt,
        uint8 v,
        bytes32 r,
        bytes32 s
    );

    event Finished();

    address public PROXY_CONTRACT;
    address public EXCHANGE_CONTRACT;
    address public PROTOCOL_TOKEN_CONTRACT;
    address public ETH_TOKEN_CONTRACT;

    Exchange exchange;
    Token protocolToken;
    EtherToken ethToken;

    bool public isInitialized;
    bool public isFinished;
    Order order;

    struct Order {
        address maker;
        address taker;
        address makerToken;
        address takerToken;
        address feeRecipient;
        uint makerTokenAmount;
        uint takerTokenAmount;
        uint makerFee;
        uint takerFee;
        uint expirationTimestampInSec;
        uint salt;
        uint8 v;
        bytes32 r;
        bytes32 s;
        bytes32 orderHash;
    }

    modifier saleInitialized() {
        require(isInitialized);
        _;
    }

    modifier saleNotInitialized() {
        require(!isInitialized);
        _;
    }

    modifier saleNotFinished() {
        require(!isFinished);
        _;
    }

    function SimpleCrowdsale(
        address _exchange,
        address _proxy,
        address _protocolToken,
        address _ethToken)
    {
        PROXY_CONTRACT = _proxy;
        EXCHANGE_CONTRACT = _exchange;
        PROTOCOL_TOKEN_CONTRACT = _protocolToken;
        ETH_TOKEN_CONTRACT = _ethToken;

        exchange = Exchange(_exchange);
        protocolToken = Token(_protocolToken);
        ethToken = EtherToken(_ethToken);
    }

    /// @dev Allows users to fill stored order by sending ETH to contract.
    function()
        payable
    {
        fillOrderWithEth();
    }

    /// @dev Stores order and initializes sale.
    /// @param orderAddresses Array of order's maker, taker, makerToken, takerToken, and feeRecipient.
    /// @param orderValues Array of order's makerTokenAmount, takerTokenAmount, makerFee, takerFee, expirationTimestampInSec, and salt.
    /// @param v ECDSA signature parameter v.
    /// @param r CDSA signature parameters r.
    /// @param s CDSA signature parameters s.
    function init(
        address[5] orderAddresses,
        uint[6] orderValues,
        uint8 v,
        bytes32 r,
        bytes32 s)
        saleNotInitialized
        onlyOwner
    {
        order = Order({
            maker: orderAddresses[0],
            taker: orderAddresses[1],
            makerToken: orderAddresses[2],
            takerToken: orderAddresses[3],
            feeRecipient: orderAddresses[4],
            makerTokenAmount: orderValues[0],
            takerTokenAmount: orderValues[1],
            makerFee: orderValues[2],
            takerFee: orderValues[3],
            expirationTimestampInSec: orderValues[4],
            salt: orderValues[5],
            v: v,
            r: r,
            s: s,
            orderHash: getOrderHash(orderAddresses, orderValues)
        });

        require(order.makerToken == PROTOCOL_TOKEN_CONTRACT);
        require(order.takerToken == ETH_TOKEN_CONTRACT);

        require(isValidSignature(
            order.maker,
            order.orderHash,
            v,
            r,
            s
        ));

        assert(setTokenAllowance(order.takerToken, order.takerTokenAmount));
        isInitialized = true;

        Initialized(
            order.maker,
            order.taker,
            order.makerToken,
            order.takerToken,
            order.feeRecipient,
            order.makerTokenAmount,
            order.takerTokenAmount,
            order.makerFee,
            order.takerFee,
            order.expirationTimestampInSec,
            order.salt,
            order.v,
            order.r,
            order.s
        );
    }

    /// @dev Fills order using msg.value.
    function fillOrderWithEth()
        payable
        saleInitialized
        saleNotFinished
    {
        uint remainingEth = safeSub(order.takerTokenAmount, exchange.getUnavailableTakerTokenAmount(order.orderHash));
        uint ethToFill = min(msg.value, remainingEth);
        ethToken.deposit.value(ethToFill)();

        assert(exchange.fillOrKillOrder(
            [order.maker, order.taker, order.makerToken, order.takerToken, order.feeRecipient],
            [order.makerTokenAmount, order.takerTokenAmount, order.makerFee, order.takerFee, order.expirationTimestampInSec, order.salt],
            ethToFill,
            order.v,
            order.r,
            order.s
        ));
        uint filledProtocolToken = safeDiv(safeMul(order.makerTokenAmount, ethToFill), order.takerTokenAmount);
        assert(protocolToken.transfer(msg.sender, filledProtocolToken));

        if (ethToFill < msg.value) {
            assert(msg.sender.send(safeSub(msg.value, ethToFill)));
        }
        if (remainingEth == ethToFill) {
            isFinished = true;
            Finished();
        }
    }
    
    function setTokenAllowance(address _token, uint _allowance)
        onlyOwner
        returns (bool success)
    {
        assert(Token(_token).approve(PROXY_CONTRACT, _allowance));
        return true;
    }

    /// @dev Calculates Keccak-256 hash of order with specified parameters.
    /// @param orderAddresses Array of order's maker, taker, makerToken, takerToken, and feeRecipient.
    /// @param orderValues Array of order's makerTokenAmount, takerTokenAmount, makerFee, takerFee, expirationTimestampInSec, and salt.
    /// @return Keccak-256 hash of order.
    function getOrderHash(address[5] orderAddresses, uint[6] orderValues)
        constant
        returns (bytes32 orderHash)
    {
        return sha3(
            EXCHANGE_CONTRACT,
            orderAddresses[0],
            orderAddresses[1],
            orderAddresses[2],
            orderAddresses[3],
            orderAddresses[4],
            orderValues[0],
            orderValues[1],
            orderValues[2],
            orderValues[3],
            orderValues[4],
            orderValues[5]
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
