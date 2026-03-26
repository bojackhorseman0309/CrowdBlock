// scripts/deploy-crowdfunding.js
const { ethers } = require("hardhat");
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CrowdFunding contract with the account:", deployer.address);
  const CrowdFunding = await ethers.getContractFactory("CrowdFunding");
  const crowdFunding = await CrowdFunding.deploy();
  console.log("CrowdFunding contract deployed to address:", crowdFunding.address);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });