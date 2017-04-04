pragma solidity ^0.4.8;


/// @title Multisignature wallet - Allows multiple parties to agree on transactions before execution.
/// @author Stefan George - <stefan.george@consensys.net>
/// @author Amir Bandeali - <amir@0xProject.com>

contract MultiSigWallet {

  uint constant public MAX_OWNER_COUNT = 50;

  event Confirmation(address indexed sender, uint indexed transactionId);
  event Revocation(address indexed sender, uint indexed transactionId);
  event Submission(uint indexed transactionId);
  event RequiredConfirmationsReached(uint indexed transactionId, uint confirmationTime);
  event Unconfirmed(uint indexed transactionId);
  event Execution(uint indexed transactionId);
  event ExecutionFailure(uint indexed transactionId);
  event Deposit(address indexed sender, uint value);
  event OwnerAddition(address indexed owner);
  event OwnerRemoval(address indexed owner);
  event RequiredConfirmationsChange(uint confirmationsRequired);
  event RequiredSecondsChange(uint secondsRequired);

  mapping (uint => Transaction) public transactions;
  mapping (uint => mapping (address => bool)) public confirmations;
  mapping (address => bool) public isOwner;
  address[] public owners;
  uint public confirmationsRequired;
  uint public secondsRequired;
  uint public transactionCount;

  struct Transaction {
    address destination;
    uint value;
    uint confirmationTime;
    bytes data;
    bool executed;
  }

  modifier onlyWallet() {
    if (msg.sender != address(this)) throw;
    _;
  }

  modifier ownerDoesNotExist(address owner) {
    if (isOwner[owner]) throw;
    _;
  }

  modifier ownerExists(address owner) {
    if (!isOwner[owner]) throw;
    _;
  }

  modifier transactionExists(uint transactionId) {
    if (transactions[transactionId].destination == 0) throw;
    _;
  }

  modifier confirmed(uint transactionId, address owner) {
    if (!confirmations[transactionId][owner]) throw;
    _;
  }

  modifier notConfirmed(uint transactionId, address owner) {
    if (confirmations[transactionId][owner]) throw;
    _;
  }

  modifier notExecuted(uint transactionId) {
    if (transactions[transactionId].executed) throw;
    _;
  }

  modifier notNull(address _address) {
    if (_address == 0) throw;
    _;
  }

  modifier validRequirement(uint ownerCount, uint _required) {
    if ( ownerCount > MAX_OWNER_COUNT
      || _required > ownerCount
      || _required == 0
      || ownerCount == 0)
      throw;
    _;
  }

  /// @dev Fallback function allows to deposit ether.
  function()
    payable
  {
    if (msg.value > 0) Deposit(msg.sender, msg.value);
  }

  /*
   * Public functions
   */

  /// @dev Contract constructor sets initial owners and required number of confirmations.
  /// @param _owners List of initial owners.
  /// @param _confirmationsRequired Number of required confirmations.
  /// @param _secondsRequired Duration needed after a transaction is confirmed and before it becomes executable, in seconds.
  function MultiSigWallet(address[] _owners, uint _confirmationsRequired, uint _secondsRequired)
    public
    validRequirement(_owners.length, _confirmationsRequired)
  {
    for (uint i = 0; i < _owners.length; i++) {
      if (isOwner[_owners[i]] || _owners[i] == 0) throw;
      isOwner[_owners[i]] = true;
    }
    owners = _owners;
    confirmationsRequired = _confirmationsRequired;
    secondsRequired = _secondsRequired;
  }

  /// @dev Allows to add a new owner. Transaction has to be sent by wallet.
  /// @param owner Address of new owner.
  function addOwner(address owner)
    public
    onlyWallet
    ownerDoesNotExist(owner)
    notNull(owner)
    validRequirement(owners.length + 1, confirmationsRequired)
  {
    isOwner[owner] = true;
    owners.push(owner);
    OwnerAddition(owner);
  }

  /// @dev Allows to remove an owner. Transaction has to be sent by wallet.
  /// @param owner Address of owner.
  function removeOwner(address owner)
    public
    onlyWallet
    ownerExists(owner)
  {
    isOwner[owner] = false;
    for (uint i = 0; i < owners.length - 1; i++) {
      if (owners[i] == owner) {
        owners[i] = owners[owners.length - 1];
        owners.length -= 1;
        break;
      }
    }
    if (confirmationsRequired > owners.length) changeRequiredConfirmations(owners.length);
    OwnerRemoval(owner);
  }

  /// @dev Allows to replace an owner with a new owner. Transaction has to be sent by wallet.
  /// @param owner Address of owner to be replaced.
  /// @param owner Address of new owner.
  function replaceOwner(address owner, address newOwner)
    public
    onlyWallet
    ownerExists(owner)
    ownerDoesNotExist(newOwner)
  {
    for (uint i = 0; i < owners.length; i++) {
      if (owners[i] == owner) {
        owners[i] = newOwner;
        break;
      }
    }
    isOwner[owner] = false;
    isOwner[newOwner] = true;
    OwnerRemoval(owner);
    OwnerAddition(newOwner);
  }

  /// @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
  /// @param _confirmationsRequired Number of required confirmations.
  function changeRequiredConfirmations(uint _confirmationsRequired)
    public
    onlyWallet
    validRequirement(owners.length, _confirmationsRequired)
  {
    confirmationsRequired = _confirmationsRequired;
    RequiredConfirmationsChange(_confirmationsRequired);
  }

  /// @dev Changes the activation threshold between when a transaction gets confirmed and becomes executable.
  /// @param _secondsRequired Duration needed after a transaction is confirmed and before it becomes executable, in seconds.
  function changeRequiredSeconds(uint _secondsRequired)
    public
    onlyWallet
  {
    secondsRequired = _secondsRequired;
    RequiredSecondsChange(_secondsRequired);
  }

  /// @dev Allows an owner to submit and confirm a transaction.
  /// @param destination Transaction target address.
  /// @param value Transaction ether value.
  /// @param data Transaction data payload.
  /// @return Returns transaction ID.
  function submitTransaction(address destination, uint value, bytes data)
    public
    returns (uint transactionId)
  {
    transactionId = addTransaction(destination, value, data);
    confirmTransaction(transactionId);
  }

  /// @dev Allows an owner to confirm a transaction.
  /// @param transactionId Transaction ID.
  function confirmTransaction(uint transactionId)
    public
    ownerExists(msg.sender)
    transactionExists(transactionId)
    notConfirmed(transactionId, msg.sender)
  {
    confirmations[transactionId][msg.sender] = true;
    Confirmation(msg.sender, transactionId);
    if (!isConfirmationTimeSet(transactionId) && isConfirmed(transactionId)) {
      setConfirmationTime(transactionId, block.timestamp);
    }
  }

  /// @dev Allows an owner to revoke a confirmation for a transaction.
  /// @param transactionId Transaction ID.
  function revokeConfirmation(uint transactionId)
    public
    ownerExists(msg.sender)
    confirmed(transactionId, msg.sender)
    notExecuted(transactionId)
  {
    confirmations[transactionId][msg.sender] = false;
    Revocation(msg.sender, transactionId);
    if (isConfirmationTimeSet(transactionId) && !isConfirmed(transactionId)) {
      setConfirmationTime(transactionId, 0);
    }
  }

  /// @dev Allows anyone to execute a confirmed transaction.
  /// @param transactionId Transaction ID.
  function executeTransaction(uint transactionId)
    public
    notExecuted(transactionId)
  {
    if (isPastRequiredSeconds(transactionId)) {
      Transaction tx = transactions[transactionId];
      tx.executed = true;
      if (tx.destination.call.value(tx.value)(tx.data))
        Execution(transactionId);
      else {
        ExecutionFailure(transactionId);
        tx.executed = false;
      }
    }
  }

  /// @dev Returns the confirmation status of a transaction.
  /// @param transactionId Transaction ID.
  /// @return Confirmation status.
  function isConfirmed(uint transactionId)
    public
    constant
    returns (bool)
  {
    uint count = 0;
    for (uint i = 0; i < owners.length; i++) {
      if (confirmations[transactionId][owners[i]]) count += 1;
      if (count >= confirmationsRequired) return true;
    }
  }

  /// @dev Checks if a transaction's confirmation time has been set.
  /// @param transactionId Transaction ID.
  /// @return Status of confirmation time.
  function isConfirmationTimeSet(uint transactionId)
    public
    constant
    returns (bool)
  {
    return transactions[transactionId].confirmationTime != 0;
  }

  /// @dev Checks if a confirmed submission is executable.
  /// @param transactionId Transaction ID.
  /// @return Status of transaction executability.
  function isPastRequiredSeconds(uint transactionId)
    public
    constant
    returns (bool)
  {
    uint confirmationTime = transactions[transactionId].confirmationTime;
    return confirmationTime != 0 && block.timestamp >= confirmationTime + secondsRequired;
  }

  /*
   * Internal functions
   */

  /// @dev Adds a new transaction to the transaction mapping, if transaction does not exist yet.
  /// @param destination Transaction target address.
  /// @param value Transaction ether value.
  /// @param data Transaction data payload.
  /// @return Returns transaction ID.
  function addTransaction(address destination, uint value, bytes data)
    internal
    notNull(destination)
    returns (uint transactionId)
  {
    transactionId = transactionCount;
    transactions[transactionId] = Transaction({
      destination: destination,
      value: value,
      confirmationTime: 0,
      data: data,
      executed: false
    });
    transactionCount += 1;
    Submission(transactionId);
  }

  /// @dev Sets the time of when a submission first passed.
  function setConfirmationTime(uint transactionId, uint confirmationTime)
    internal
  {
    transactions[transactionId].confirmationTime = confirmationTime;
    if (confirmationTime == 0) {
      Unconfirmed(transactionId);
    } else {
      RequiredConfirmationsReached(transactionId, confirmationTime);
    }
  }

  /*
   * Web3 call functions
   */

  /// @dev Returns number of confirmations of a transaction.
  /// @param transactionId Transaction ID.
  /// @return Number of confirmations.
  function getConfirmationCount(uint transactionId)
    public
    constant
    returns (uint count)
  {
    for (uint i = 0; i < owners.length; i++) {
      if (confirmations[transactionId][owners[i]]) count += 1;
    }
  }

  /// @dev Returns total number of transactions after filers are applied.
  /// @param pending Include pending transactions.
  /// @param executed Include executed transactions.
  /// @return Total number of transactions after filters are applied.
  function getTransactionCount(bool pending, bool executed)
    public
    constant
    returns (uint count)
  {
    for (uint i = 0; i < transactionCount; i++)
      if ( pending && !transactions[i].executed
        || executed && transactions[i].executed
      ) count += 1;
  }

  /// @dev Returns list of owners.
  /// @return List of owner addresses.
  function getOwners()
    public
    constant
    returns (address[])
  {
    return owners;
  }

  /// @dev Returns array with owner addresses, which confirmed transaction.
  /// @param transactionId Transaction ID.
  /// @return Returns array of owner addresses.
  function getConfirmations(uint transactionId)
    public
    constant
    returns (address[] _confirmations)
  {
    address[] memory confirmationsTemp = new address[](owners.length);
    uint count = 0;
    uint i;
    for (i = 0; i < owners.length; i++) {
      if (confirmations[transactionId][owners[i]]) {
        confirmationsTemp[count] = owners[i];
        count += 1;
      }
    }
    _confirmations = new address[](count);
    for (i = 0; i < count; i++) {
      _confirmations[i] = confirmationsTemp[i];
    }
  }

  /// @dev Returns list of transaction IDs in defined range.
  /// @param from Index start position of transaction array.
  /// @param to Index end position of transaction array.
  /// @param pending Include pending transactions.
  /// @param executed Include executed transactions.
  /// @return Returns array of transaction IDs.
  function getTransactionIds(uint from, uint to, bool pending, bool executed)
    public
    constant
    returns (uint[] _transactionIds)
  {
    uint[] memory transactionIdsTemp = new uint[](transactionCount);
    uint count = 0;
    uint i;
    for (i = 0; i < transactionCount; i++) {
      if ( pending && !transactions[i].executed
        || executed && transactions[i].executed
      ) {
        transactionIdsTemp[count] = i;
        count += 1;
      }
    }
    _transactionIds = new uint[](to - from);
    for (i = from; i < to; i++) {
      _transactionIds[i - from] = transactionIdsTemp[i];
    }
  }
}
