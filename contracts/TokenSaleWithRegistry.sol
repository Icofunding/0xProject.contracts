pragma solidity ^0.4.11;

import "./Exchange.sol";
import "./tokens/EtherToken.sol";
import "./base/Token.sol";
import "./base/Ownable.sol";
import "./base/SafeMath.sol";

contract TokenSaleWithRegistry is Ownable, SafeMath {

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

    mapping (address => bool) public registered;
    mapping (address => uint) public contributed;

    bool public isInitialized;
    bool public isFinished;
    uint public ethCapPerAddress;
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
        assert(isInitialized);
        _;
    }

    modifier saleNotInitialized() {
        assert(!isInitialized);
        _;
    }

    modifier saleNotFinished() {
        assert(!isFinished);
        _;
    }

    modifier callerIsRegistered() {
        require(registered[msg.sender]);
        _;
    }

    function TokenSaleWithRegistry(
        address _exchange,
        address _proxy,
        address _protocolToken,
        address _ethToken,
        uint _capPerAddress)
    {
        PROXY_CONTRACT = _proxy;
        EXCHANGE_CONTRACT = _exchange;
        PROTOCOL_TOKEN_CONTRACT = _protocolToken;
        ETH_TOKEN_CONTRACT = _ethToken;
        ethCapPerAddress = _capPerAddress;

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
        public
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

        require(order.taker == address(this));
        require(order.makerToken == PROTOCOL_TOKEN_CONTRACT);
        require(order.takerToken == ETH_TOKEN_CONTRACT);

        require(isValidSignature(
            order.maker,
            order.orderHash,
            v,
            r,
            s
        ));

        assert(Token(ETH_TOKEN_CONTRACT).approve(PROXY_CONTRACT, order.takerTokenAmount));
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
        public
        payable
        saleInitialized
        saleNotFinished
        callerIsRegistered
    {
        uint remainingEth = safeSub(order.takerTokenAmount, exchange.getUnavailableTakerTokenAmount(order.orderHash));
        uint allowedEth = safeSub(ethCapPerAddress, contributed[msg.sender]);
        uint ethToFill = min256(min256(msg.value, remainingEth), allowedEth);
        ethToken.deposit.value(ethToFill)();

        contributed[msg.sender] = safeAdd(contributed[msg.sender], ethToFill);

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

    /// @dev Sets the cap per address to a new value.
    /// @param _newCapPerAddress New value of the cap per address.
    function setCapPerAddress(uint _newCapPerAddress)
        public
        onlyOwner
    {
        ethCapPerAddress = _newCapPerAddress;
    }

    /// @dev Changes registration status of an address for participation.
    /// @param target Address that will be registered/deregistered.
    /// @param isRegistered New registration status of address.
    function changeRegistrationStatus(address target, bool isRegistered)
        public
        onlyOwner
        saleNotInitialized
    {
        registered[target] = isRegistered;
    }

    /// @dev Changes registration statuses of addresses for participation.
    /// @param targets Addresses that will be registered/deregistered.
    /// @param isRegistered New registration status of addresss.
    function changeRegistrationStatuses(address[] targets, bool isRegistered)
        public
        onlyOwner
        saleNotInitialized
    {
        for (uint i = 0; i < targets.length; i++) {
            changeRegistrationStatus(targets[i], isRegistered);
        }
    }

    /// @dev Calculates Keccak-256 hash of order with specified parameters.
    /// @param orderAddresses Array of order's maker, taker, makerToken, takerToken, and feeRecipient.
    /// @param orderValues Array of order's makerTokenAmount, takerTokenAmount, makerFee, takerFee, expirationTimestampInSec, and salt.
    /// @return Keccak-256 hash of order.
    function getOrderHash(address[5] orderAddresses, uint[6] orderValues)
        public
        constant
        returns (bytes32 orderHash)
    {
        return keccak256(
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
        public
        constant
        returns (bool isValid)
    {
        return pubKey == ecrecover(
            keccak256("\x19Ethereum Signed Message:\n32", hash),
            v,
            r,
            s
        );
    }
}
