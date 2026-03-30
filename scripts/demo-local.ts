import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [creator, donor] = await ethers.getSigners();
  const Factory: any = await ethers.getContractFactory("Crowdfunding");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const latest = await ethers.provider.getBlock("latest");
  const deadline = BigInt((latest?.timestamp ?? 0) + 3600);
  const goal = ethers.parseEther("1");

  const createTx = await contract.connect(creator).createCampaign("Demo Campaign", goal, deadline);
  await createTx.wait();

  const donateTx = await contract.connect(donor).donate(0, { value: goal });
  await donateTx.wait();

  const withdrawTx = await contract.connect(creator).withdraw(0);
  await withdrawTx.wait();

  const campaign = await contract.campaigns(0);

  console.log("Contract:", await contract.getAddress());
  console.log("Creator:", creator.address);
  console.log("Donor:", donor.address);
  console.log("Raised:", ethers.formatEther(campaign.amountRaised), "token nativo");
  console.log("Withdrawn:", campaign.withdrawn);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
