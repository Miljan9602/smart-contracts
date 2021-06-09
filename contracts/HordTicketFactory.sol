//"SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155PausableUpgradeable.sol";
import "./system/HordMiddleware.sol";
import "./interfaces/IHordTicketManager.sol";

/**
 * HordTicketFactory contract.
 * @author Nikola Madjarevic
 * Date created: 8.5.21.
 * Github: madjarevicn
 */
contract HordTicketFactory is ERC1155PausableUpgradeable, HordMiddleware {

    // Store contract uri
    string contractLevelURI;
    // Store always last ID minted
    uint256 public lastMintedTokenId;
    // Maximal number of fungible tickets per Pool
    uint256 public maxFungibleTicketsPerPool;
    // Maximal number of fungible tickets per Pool
    mapping (uint256 => uint256) tokenIdToMaxFungibleTicketsPerPool;
    // Mapping token ID to minted supply
    mapping (uint256 => uint256) tokenIdToMintedSupply;

    // Manager contract handling tickets
    IHordTicketManager public hordTicketManager;


    event MintedNewNFT (
        uint256 tokenId,
        uint256 championId,
        uint256 initialSupply
    );

    event AddedNFTSupply(
        uint256 tokenId,
        uint256 supplyAdded
    );

    function initialize(
        address _hordCongress,
        address _maintainersRegistry,
        address _hordTicketManager,
        uint256 _maxFungibleTicketsPerPool,
        string memory _uri,
        string memory _contractLevelURI
    )
    public
    initializer
    {
        __ERC1155_init(_uri);

        // Set hord congress and maintainers registry contract
        setCongressAndMaintainers(_hordCongress, _maintainersRegistry);
        // Set hord ticket manager contract
        hordTicketManager = IHordTicketManager(_hordTicketManager);
        // Set max fungible tickets allowed to mint per pool
        maxFungibleTicketsPerPool = _maxFungibleTicketsPerPool;
        // Set contract level uri for Opensea
        contractLevelURI = _contractLevelURI;
    }

    /**
     * @notice  Function allowing congress to pause the smart-contract
     * @dev     Can be only called by HordCongress
     */
    function pause()
    public
    onlyHordCongress
    {
        _pause();
    }

    /**
     * @notice  Function allowing congress to unpause the smart-contract
     * @dev     Can be only called by HordCongress
     */
    function unpause()
    public
    onlyHordCongress
    {
        _unpause();
    }

    /**
     * @notice  Function to set uri, callable only by congress
     */
    function setNewUri(
        string memory _newUri
    )
    public
    onlyHordCongress
    {
        _setURI(_newUri);
    }

    /**
     * @notice  Function to set contract level uri, callable by congress only
     */
    function setNewContractLevelUri(
        string memory _contractLevelURI
    )
    public
    onlyHordCongress
    {
        contractLevelURI = _contractLevelURI;
    }

    /**
     * @notice Set maximal fungible tickets possible to mint per pool (pool == class == tokenId)
     */
    function setMaxFungibleTicketsPerPool(
        uint _maxFungibleTicketsPerPool
    )
    external
    onlyHordCongress
    {
        require(_maxFungibleTicketsPerPool > 0);
        maxFungibleTicketsPerPool = _maxFungibleTicketsPerPool;
    }

    /**
     * @notice Mint new HPool NFT token.
     */
    function mintNewHPoolNFT(
        uint256 tokenId,
        uint256 initialSupply,
        uint256 championId
    )
    public
    onlyMaintainer
    {
        require(initialSupply <= maxFungibleTicketsPerPool, "MintNewHPoolNFT: Initial supply overflow.");
        require(tokenId == lastMintedTokenId.add(1), "MintNewHPoolNFT: Token ID is wrong.");

        // Store maximal fungible tickets per pool at the moment of token creation
        tokenIdToMaxFungibleTicketsPerPool[tokenId] = maxFungibleTicketsPerPool;

        // Set initial supply
        tokenIdToMintedSupply[tokenId] = initialSupply;

        // Mint tokens and store them on contract itself
        _mint(address(hordTicketManager), tokenId, initialSupply, "0x0");

        // Fire event
        emit MintedNewNFT(tokenId, championId, initialSupply);

        // Map champion id with token id
        hordTicketManager.addNewTokenIdForChampion(tokenId, championId);

        // Store always last minted token id.
        lastMintedTokenId = tokenId;
    }


    /**
     * @notice  Add supply to existing token
     */
    function addTokenSupply(
        uint256 tokenId,
        uint256 supplyToAdd
    )
    public
    onlyMaintainer
    {
        require(tokenIdToMintedSupply[tokenId] > 0, "AddTokenSupply: Firstly MINT token, then expand supply.");
        require(tokenIdToMintedSupply[tokenId].add(supplyToAdd) <= tokenIdToMaxFungibleTicketsPerPool[tokenId], "More than allowed.");

        _mint(address(hordTicketManager), tokenId, supplyToAdd, "0x0");

        // Fire an event
        emit AddedNFTSupply(tokenId, supplyToAdd);
    }

    /**
     * @notice  Register max fungible tickets per pool for token id
     * @param   tokenId is the ID of the token
     * @param   _maximalFungibleTicketsPerPoolForTokenId is new maximal amount of tokens per pool
     * @dev     used only for allowing adding token supply.
     */
    function setMaxFungibleTicketsPerPoolForTokenId(
        uint tokenId,
        uint _maximalFungibleTicketsPerPoolForTokenId
    )
    public
    onlyMaintainer
    {
        require(tokenIdToMintedSupply[tokenId] <= _maximalFungibleTicketsPerPoolForTokenId);
        tokenIdToMaxFungibleTicketsPerPool[tokenId] = _maximalFungibleTicketsPerPoolForTokenId;
    }

    /**
     * @notice  Function to return a URL for the storefront-level metadata for your contract.
     */
    function contractURI() public view returns (string memory) {
        return contractLevelURI;
    }

    /**
     * @notice  Get total supply minted for tokenId
     */
    function getTokenSupply(
        uint tokenId
    )
    external
    view
    returns (uint256)
    {
        return tokenIdToMintedSupply[tokenId];
    }
}
