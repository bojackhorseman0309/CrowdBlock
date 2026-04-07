import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const Factory: any = await ethers.getContractFactory("Crowdfunding");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();

  console.log("Crowdfunding deployed at:", await contract.getAddress());
  console.log("Owner:", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
