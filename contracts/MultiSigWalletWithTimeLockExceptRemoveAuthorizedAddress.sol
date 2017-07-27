pragma solidity 0.4.11;

import "./MultiSigWalletWithTimeLock.sol";

contract MultiSigWalletWithTimeLockExceptRemoveAuthorizedAddress is MultiSigWalletWithTimeLock {

    address public TOKEN_PROXY_CONTRACT;

    modifier validRemoveAuthorizedAddressTx(uint transactionId) {
        Transaction storage tx = transactions[transactionId];
        require(tx.destination == TOKEN_PROXY_CONTRACT);
        require(isFunctionRemoveAuthorizedAddress(tx.data));
        _;
    }

    /// @dev Contract constructor sets initial owners, required number of confirmations, time lock, and tokenProxy address.
    /// @param _owners List of initial owners.
    /// @param _required Number of required confirmations.
    /// @param _secondsTimeLocked Duration needed after a transaction is confirmed and before it becomes executable, in seconds.
    /// @param _tokenProxy Address of TokenProxy contract.
    function MultiSigWalletWithTimeLockExceptRemoveAuthorizedAddress(
        address[] _owners,
        uint _required,
        uint _secondsTimeLocked,
        address _tokenProxy)
        public
        MultiSigWalletWithTimeLock(_owners, _required, _secondsTimeLocked)
    {
        TOKEN_PROXY_CONTRACT = _tokenProxy;
    }

    /// @dev Allows execution of removeAuthorizedAddress without time lock.
    /// @param transactionId Transaction ID.
    function executeRemoveAuthorizedAddress(uint transactionId)
        public
        notExecuted(transactionId)
        confirmationTimeSet(transactionId)
        validRemoveAuthorizedAddressTx(transactionId)
    {
        Transaction storage tx = transactions[transactionId];
        tx.executed = true;
        if (tx.destination.call.value(tx.value)(tx.data))
            Execution(transactionId);
        else {
            ExecutionFailure(transactionId);
            tx.executed = false;
        }
    }

    /// @dev Compares first 4 bytes of byte array to removeAuthorizedAddress function signature.
    /// @param data Transaction data.
    /// @return Successful if data is a call to removeAuthorizedAddress.
    function isFunctionRemoveAuthorizedAddress(bytes data)
        public
        constant
        returns (bool)
    {
        bytes4 removeAuthorizedAddressSignature = bytes4(sha3("removeAuthorizedAddress(address)"));
        for (uint i = 0; i < 4; i++) {
            require(data[i] == removeAuthorizedAddressSignature[i]);
        }
        return true;
    }
}
