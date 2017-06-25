pragma solidity ^0.4.11;

import "./SimpleCrowdsale.sol";

contract CrowdsaleWithRegistry is SimpleCrowdsale {

    mapping (address => bool) public registered;
    mapping (address => uint) public contributed;

    uint public capPerAddress;

    modifier callerIsRegistered() {
        require(registered[msg.sender]);
        _;
    }

    function CrowdsaleWithRegistry(
        address _exchange,
        address _proxy,
        address _protocolToken,
        address _ethToken,
        uint _capPerAddress)
        SimpleCrowdsale( _exchange, _proxy, _protocolToken, _ethToken)
    {
        capPerAddress = _capPerAddress;
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
        callerIsRegistered
    {
        uint remainingEth = safeSub(order.takerTokenAmount, exchange.getUnavailableTakerTokenAmount(order.orderHash));
        uint allowedEth = safeSub(capPerAddress, contributed[msg.sender]);
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

    /// @dev Registers an address for participation.
    /// @param addressToRegister Address that will be registered.
    function registerAddress(address addressToRegister)
        onlyOwner
    {
        registered[addressToRegister] = true;
    }

    /// @dev Registers addresses for participation.
    /// @param addressesToRegister Addresses that will be registered.
    function registerAddresses(address[] addressesToRegister)
        onlyOwner
    {
        for (uint i = 0; i < addressesToRegister.length; i++) {
            registerAddress(addressesToRegister[i]);
        }
    }

    /// @dev Deregisters an address from participation.
    /// @param addressToDeregister Address that will be deregistered.
    function deregisterAddress(address addressToDeregister)
        onlyOwner
    {
        registered[addressToDeregister] = false;
    }

    /// @dev Deregisters addresses from participation.
    /// @param addressesToDeregister Addresses that will be deregistered.
    function deregisterAddresses(address[] addressesToDeregister)
        onlyOwner
    {
        for (uint i = 0; i < addressesToDeregister.length; i++) {
            deregisterAddress(addressesToDeregister[i]);
        }
    }

    /// @dev Sets the cap per address to a new value.
    /// @param _newCapPerAddress New value of the cap per address.
    function setCapPerAddress(uint _newCapPerAddress)
        onlyOwner
    {
        capPerAddress = _newCapPerAddress;
    }
}
