import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const Factory: any = await ethers.getContractFactory("Crowdfunding");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  console.log("Crowdfunding deployed at:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
