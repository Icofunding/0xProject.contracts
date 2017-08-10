/*

  Copyright 2017 ZeroEx Intl.

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

pragma solidity 0.4.11;

import "./Exchange.sol";
import "./tokens/EtherToken.sol";
import "./base/Token.sol";
import "./base/Ownable.sol";
import "./base/SafeMath.sol";

contract TokenSale is Ownable, SafeMath {

    event SaleInitialized(uint startTimeInSec);
    event SaleFinished(uint endTimeInSec);

    uint public constant TIME_PERIOD_IN_SEC = 1 days;

    Exchange exchange;
    Token protocolToken;
    EtherToken ethToken;

    mapping (address => bool) public registered;
    mapping (address => uint) public contributed;

    bool public isSaleInitialized;
    bool public isSaleFinished;
    uint public baseEthCapPerAddress;
    uint public startTimeInSec;
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

    modifier saleNotInitialized() {
        require(!isSaleInitialized);
        _;
    }

    modifier saleStarted() {
        require(isSaleInitialized && block.timestamp >= startTimeInSec);
        _;
    }

    modifier saleNotFinished() {
        require(!isSaleFinished);
        _;
    }

    modifier onlyRegistered() {
        require(registered[msg.sender]);
        _;
    }

    modifier validStartTime(uint _startTimeInSec) {
        require(_startTimeInSec >= block.timestamp);
        _;
    }

    modifier validBaseEthCapPerAddress(uint _ethCapPerAddress) {
        require(_ethCapPerAddress != 0);
        _;
    }

    function TokenSale(
        address _exchange,
        address _protocolToken,
        address _ethToken)
    {
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

    /// @dev Stores order and initializes sale parameters.
    /// @param orderAddresses Array of order's maker, taker, makerToken, takerToken, and feeRecipient.
    /// @param orderValues Array of order's makerTokenAmount, takerTokenAmount, makerFee, takerFee, expirationTimestampInSec, and salt.
    /// @param v ECDSA signature parameter v.
    /// @param r ECDSA signature parameters r.
    /// @param s ECDSA signature parameters s.
    /// @param _startTimeInSec Time that token sale begins in seconds since epoch.
    /// @param _baseEthCapPerAddress The ETH cap per address for the first time period.
    function initializeSale(
        address[5] orderAddresses,
        uint[6] orderValues,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint _startTimeInSec,
        uint _baseEthCapPerAddress)
        public
        saleNotInitialized
        onlyOwner
        validStartTime(_startTimeInSec)
        validBaseEthCapPerAddress(_baseEthCapPerAddress)
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
            orderHash: exchange.getOrderHash(orderAddresses, orderValues)
        });

        require(order.taker == address(this));
        require(order.makerToken == address(protocolToken));
        require(order.takerToken == address(ethToken));
        require(order.feeRecipient == address(0));

        require(isValidSignature(
            order.maker,
            order.orderHash,
            v,
            r,
            s
        ));

        require(ethToken.approve(exchange.TOKEN_TRANSFER_PROXY_CONTRACT(), order.takerTokenAmount));
        isSaleInitialized = true;
        startTimeInSec = _startTimeInSec;
        baseEthCapPerAddress = _baseEthCapPerAddress;

        SaleInitialized(_startTimeInSec);
    }

    /// @dev Fills order using msg.value. Should not be called by contracts unless able to access the protocol token after execution.
    function fillOrderWithEth()
        public
        payable
        saleStarted
        saleNotFinished
        onlyRegistered
    {
        uint remainingEth = safeSub(order.takerTokenAmount, exchange.getUnavailableTakerTokenAmount(order.orderHash));
        uint ethCapPerAddress = getEthCapPerAddress();
        uint allowedEth = safeSub(ethCapPerAddress, contributed[msg.sender]);
        uint ethToFill = min256(min256(msg.value, remainingEth), allowedEth);
        ethToken.deposit.value(ethToFill)();

        contributed[msg.sender] = safeAdd(contributed[msg.sender], ethToFill);

        exchange.fillOrKillOrder(
            [order.maker, order.taker, order.makerToken, order.takerToken, order.feeRecipient],
            [order.makerTokenAmount, order.takerTokenAmount, order.makerFee, order.takerFee, order.expirationTimestampInSec, order.salt],
            ethToFill,
            order.v,
            order.r,
            order.s
        );
        uint filledProtocolToken = safeDiv(safeMul(order.makerTokenAmount, ethToFill), order.takerTokenAmount);
        require(protocolToken.transfer(msg.sender, filledProtocolToken));

        if (ethToFill < msg.value) {
            require(msg.sender.send(safeSub(msg.value, ethToFill)));
        }
        if (remainingEth == ethToFill) {
            isSaleFinished = true;
            SaleFinished(block.timestamp);
            return;
        }
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

    /// @dev Calculates the ETH cap per address. The cap increases by double the previous increase at each next period. E.g 1, 3, 7, 15
    /// @return The current ETH cap per address.
    function getEthCapPerAddress()
        public
        constant
        returns (uint)
    {
        if (block.timestamp < startTimeInSec || startTimeInSec == 0) return 0;

        uint timeSinceStartInSec = safeSub(block.timestamp, startTimeInSec);
        uint currentPeriod = safeAdd(                           // currentPeriod begins at 1
              safeDiv(timeSinceStartInSec, TIME_PERIOD_IN_SEC), // rounds down
              1
        );

        uint ethCapPerAddress = safeMul(
            baseEthCapPerAddress,
            safeSub(
                2 ** currentPeriod,
                1
            )
        );
        return ethCapPerAddress;
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
        returns (bool)
    {
        return pubKey == ecrecover(
            keccak256("\x19Ethereum Signed Message:\n32", hash),
            v,
            r,
            s
        );
    }

    /// @dev Getter function for initialized order's orderHash.
    /// @return orderHash of initialized order or null.
    function getOrderHash()
        public
        constant
        returns (bytes32)
    {
        return order.orderHash;
    }

    /// @dev Getter function for initialized order's makerTokenAmount.
    /// @return makerTokenAmount of initialized order or 0.
    function getOrderMakerTokenAmount()
        public
        constant
        returns (uint)
    {
        return order.makerTokenAmount;
    }

    /// @dev Getter function for initialized order's takerTokenAmount.
    /// @return takerTokenAmount of initialized order or 0.
    function getOrderTakerTokenAmount()
        public
        constant
        returns (uint)
    {
        return order.takerTokenAmount;
    }
}
