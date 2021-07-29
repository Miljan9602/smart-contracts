// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "../interfaces/IMaintainersRegistry.sol";

/**
 * HordUpgradables contract.
 * @author Nikola Madjarevic
 * Date created: 8.5.21.
 * Github: madjarevicn
 */
contract HordUpgradable {

    address public hordCongress;
    IMaintainersRegistry public maintainersRegistry;

    // Only maintainer modifier
    modifier onlyMaintainer {
        require(maintainersRegistry.isMaintainer(msg.sender), "HordUpgradable: Restricted only to Maintainer");
        _;
    }

    // Only chainport congress modifier
    modifier onlyHordCongress {
        require(msg.sender == hordCongress, "HordUpgradable: Restricted only to HordCongress");
        _;
    }

    function setCongressAndMaintainers(
        address _hordCongress,
        address _maintainersRegistry
    )
    internal
    {
        hordCongress = _hordCongress;
        maintainersRegistry = IMaintainersRegistry(_maintainersRegistry);
    }

    function setMaintainersRegistry(
        address _maintainersRegistry
    )
    public
    onlyHordCongress
    {
        maintainersRegistry = IMaintainersRegistry(_maintainersRegistry);
    }
}
