pragma solidity ^0.4.2;
import "StandardToken.sol";

/// @title Token contract - Token exchanging Ether 1:1.
/// @author Stefan George - <stefan.george@consensys.net>
contract EtherToken is StandardToken {

    /*
     *  Constants
     */
    // Token meta data
    string constant public name = "Ether Token";
    string constant public symbol = "ETH";
    uint8 constant public decimals = 18;
    event LogBuyTokens(address indexed owner, uint indexed balance);
    event LogSellTokens(address indexed owner, uint indexed balance);

    /*
     *  Read and write functions
     */
    /// @dev Buys tokens with Ether, exchanging them 1:1. Returns success.
    function buyTokens()
        external
        payable
    {
        balances[msg.sender] += msg.value;
        totalSupply += msg.value;
        LogBuyTokens(msg.sender, balances[msg.sender]);
    }

    /// @dev Sells tokens in exchange for Ether, exchanging them 1:1. Returns success.
    /// @param count Number of tokens to sell.
    function sellTokens(uint count)
        external
    {
        if (count > balances[msg.sender]) {
            // Balance is too low
            throw;
        }
        balances[msg.sender] -= count;
        totalSupply -= count;
        if (!msg.sender.send(count)) {
            // Sending failed
            throw;
        }
        LogSellTokens(msg.sender, balances[msg.sender]);
    }
} 
