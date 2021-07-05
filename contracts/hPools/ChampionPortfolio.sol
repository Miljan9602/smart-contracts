pragma solidity ^0.6.12;

import "../libraries/SafeMath.sol";
import "../system/HordMiddleware.sol";
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

/**
 * ChampionPortfolio contract.
 * @author Nikola Madjarevic
 * Date created: 5.7.21.
 * Github: madjarevicn
 */
contract ChampionPortfolio is HordMiddleware {

    using SafeMath for uint256;

    uint256 constant public minimalEthDeposit = 10 * 10e18;

    struct Champion {
        address championAddress;
        uint256 amountDeposited;
        address [] tokens;
        uint256 [] compositions;
    }

    Champion champion;

    event ChampionDeposit(uint256 amountEth);
    event TokensAndCompositionsSet(address [] tokens, uint256 [] compositions);


    modifier onlyChampion {
        require(msg.sender == champion.championAddress, "onlyChampion: Function restricted to Champion only.");
        _;
    }


    //TODO: Can champion deposit only once
    function depositEth()
    external
    payable
    onlyChampion
    {
        champion.amountDeposited = champion.amountDeposited.add(msg.value);
        emit ChampionDeposit(msg.value);
    }


    function setTokensAndCompositions(
        address [] tokens,
        uint256 [] compositions
    )
    external
    onlyChampion
    {
        require(tokens.length == compositions.length, "setTokensAndCompositions: Bad input.");

        uint compositionsSum = 0;

        for(uint i=0; i < tokens.length; i++) {
            champion.tokens.push(tokens[i]);
            champion.compositions.push(compositions[i]);
            compositionsSum = compositions[i];
        }

        require(compositionsSum == 10e18, "Compositions sum is not 1");

        emit TokensAndCompositionsSet(tokens, compositions);
    }

}
