pragma solidity >=0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/**
 * A basic token for testing the HashedTimelockERC20.
 */
contract OnceERC20 is ERC20 {
    string public constant name = "Once upon a Token";
    string public constant symbol = "ONCE";
    uint8 public constant decimals = 18;
    uint32 public constant initialBalance = 10000*18;

    constructor() public {
        _mint(msg.sender, initialBalance);
    }
}
