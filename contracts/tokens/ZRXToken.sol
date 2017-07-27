pragma solidity 0.4.11;

import "./../base/StandardToken.sol";

contract ZRXToken is StandardToken {

    uint8 constant public decimals = 18;
    uint public totalSupply = 10**27; // 1 billion tokens, 18 decimal places
    string constant public name = "0x Protocol Token";
    string constant public symbol = "ZRX";

    mapping(address => mapping(address => bool)) allowedUnlimited;

    event UnlimitedApproval(address indexed _owner, address indexed _spender, bool _approval);

    function ZRXToken() {
        balances[msg.sender] = totalSupply;
    }

    function approveUnlimited(address _spender, bool _approval)
        public
        returns (bool)
    {
        allowedUnlimited[msg.sender][_spender] = _approval;
        UnlimitedApproval(msg.sender, _spender, _approval);
        return true;
    }

    function transferFrom(address _from, address _to, uint _value)
        public
        returns (bool)
    {
        bool hasUnlimitedAllowance = allowedUnlimited[_from][msg.sender];
        if (balances[_from] >= _value
            && (hasUnlimitedAllowance || allowed[_from][msg.sender] >= _value)
            && balances[_to] + _value >= balances[_to]
        ) {
            balances[_to] += _value;
            balances[_from] -= _value;
            if (!hasUnlimitedAllowance) {
                allowed[_from][msg.sender] -= _value;
            }
            Transfer(_from, _to, _value);
            return true;
        } else {
            return false;
        }
    }

    function unlimitedAllowance(address _owner, address _spender)
        public
        constant
        returns (bool)
    {
        return allowedUnlimited[_owner][_spender];
    }
}
