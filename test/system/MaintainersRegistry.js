const { expect } = require("chai");

describe("MaintainersRegistry", function () {

    let hordCongress;
    let maintainersRegistry;
    let maintainersRegistryInstance;
    let maintainers;
    let maintainer;
    let user1, user2;

    beforeEach(async function(){
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [hordCongress, user1, user2, maintainer, ...maintainers] = await ethers.getSigners();

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for (let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }

        maintainers[maintainers.length] = maintainer.address;
    });

    it("Should not let initialize maintainer with address 0x0.", async function () {
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = "0x000000000000000000000000000000000000000000";
        }
        await expect(maintainersRegistryInstance.initialize(maintainers, hordCongress.address))
            .to.be.reverted;
    });

    it("Should initialize and make given addresses maintainers.", async function () {
        await maintainersRegistryInstance.initialize(maintainers, hordCongress.address);
        let res;
        for(let i = 0; i < maintainers.length; i++) {
            res = await maintainersRegistryInstance.isMaintainer(maintainers[i]);
            expect(res).to.equal(true);
        }
        expect(await maintainersRegistryInstance.hordCongress()).to.equal(hordCongress.address);
    });

    it("Should not let initialize twice.", async function () {
        await maintainersRegistryInstance.initialize(maintainers, hordCongress.address);
        await expect(maintainersRegistryInstance.initialize(maintainers, hordCongress.address)).to.be.reverted;
    });

    describe("Maintainers function", function () {

        beforeEach(async function () {
               await maintainersRegistryInstance.initialize(maintainers, hordCongress.address);
        });

        it("Should add a maintainer (by congress).", async function () {
            await maintainersRegistryInstance.connect(hordCongress).addMaintainer(user1.address);
            expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
        });

        it("Should not let add a maintainer (by user).", async function () {
            await expect(maintainersRegistryInstance.connect(user2).addMaintainer(user1.address))
                .to.be.revertedWith("MaintainersRegistry :: Only congress can add maintainer");
        });

        it("Should not let add a maintainer (by maintainer).", async function () {
            await expect(maintainersRegistryInstance.connect(maintainer).addMaintainer(user1.address))
                .to.be.revertedWith("MaintainersRegistry :: Only congress can add maintainer");
        });

        it("Should not add a same maintainer twice (by congress).", async function () {
            await maintainersRegistryInstance.connect(hordCongress).addMaintainer(user1.address);
            expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
            await expect(maintainersRegistryInstance.connect(hordCongress).addMaintainer(user1.address))
                .to.be.reverted;
        });

        it("Should remove a maintainer (by congress).", async function () {
            await maintainersRegistryInstance.connect(hordCongress).addMaintainer(user1.address);
            expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
            await maintainersRegistryInstance.connect(hordCongress).removeMaintainer(user1.address);
            expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(false);
        });

        it("Should not let normal user remove a maintainer.", async function () {
            await maintainersRegistryInstance.connect(hordCongress).addMaintainer(user1.address);
            expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
            await expect(maintainersRegistryInstance.connect(user2).removeMaintainer(user1.address))
                .to.be.revertedWith("MaintainersRegistry :: Only congress can remove maintainer");
        });

        it("Should not let to maintainer remove maintainer.", async function () {
            await maintainersRegistryInstance.connect(hordCongress).addMaintainer(user1.address);
            expect(await maintainersRegistryInstance.isMaintainer(user1.address)).to.equal(true);
            await expect(maintainersRegistryInstance.connect(maintainer).removeMaintainer(user1.address))
                .to.be.revertedWith("MaintainersRegistry :: Only congress can remove maintainer");
        });

        it("Should not remove a nonexistenet maintainer (by congress).", async function () {
            await expect(maintainersRegistryInstance.connect(hordCongress).removeMaintainer(user1.address))
                .to.be.reverted;
        });

    });

});