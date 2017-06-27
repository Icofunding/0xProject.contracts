pragma solidity ^0.4.11;

import "./MultiSigWalletWithTimeLock.sol";

contract ProxyOwner is MultiSigWalletWithTimeLock {

    address public PROXY_CONTRACT;

    modifier validTxData(uint transactionId) {
        Transaction tx = transactions[transactionId];
        assert(tx.destination == PROXY_CONTRACT);
        assert(isFunctionRemoveAuthorizedAddress(tx.data));
        _;
    }

    function ProxyOwner(
        address[] _owners,
        uint _required,
        uint _secondsTimeLocked,
        address _proxy)
        public
        MultiSigWalletWithTimeLock(_owners, _required, _secondsTimeLocked)
    {
        PROXY_CONTRACT = _proxy;
    }

    function executeRemoveAuthorizedAddress(uint transactionId)
        public
        notExecuted(transactionId)
        confirmationTimeSet(transactionId)
        validTxData(transactionId)
    {
        Transaction tx = transactions[transactionId];
        tx.executed = true;
        if (tx.destination.call.value(tx.value)(tx.data))
            Execution(transactionId);
        else {
            ExecutionFailure(transactionId);
            tx.executed = false;
        }
    }

    function isFunctionRemoveAuthorizedAddress(bytes data)
        public
        constant
        returns (bool)
    {
        bytes4 removeAuthorizedAddressSignature = bytes4(sha3("removeAuthorizedAddress(address)"));
        for (uint i = 0; i < 4; i++) {
            assert(data[i] == removeAuthorizedAddressSignature[i]);
        }
        return true;
    }
}
