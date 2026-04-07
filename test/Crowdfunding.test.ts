import { expect } from "chai";
import { network } from "hardhat";

describe("Crowdfunding", function () {
  async function deployFixture(connection: Awaited<ReturnType<typeof network.connect>>) {
    const { ethers } = connection;
    const [creator, donor, other] = await ethers.getSigners();
    const Factory: any = await ethers.getContractFactory("Crowdfunding");
    const crowdfunding = await Factory.deploy(creator.address);
    await crowdfunding.waitForDeployment();

    return { crowdfunding, creator, donor, other };
  }

  async function increaseTime(connection: Awaited<ReturnType<typeof network.connect>>, seconds: number) {
    const { networkHelpers } = connection;
    await networkHelpers.time.increase(seconds);
  }

  it("creates a campaign", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);
    const goal = ethers.parseEther("1");

    await expect(crowdfunding.connect(creator).createCampaign("Laptop", goal, deadline))
      .to.emit(crowdfunding, "CampaignCreated")
      .withArgs(0, creator.address, goal, deadline, "Laptop");

    expect(await crowdfunding.campaignCount()).to.equal(1);
    const campaign = await crowdfunding.campaigns(0);
    expect(campaign.creator).to.equal(creator.address);
    expect(campaign.goal).to.equal(goal);
    expect(campaign.deadline).to.equal(deadline);
    expect(campaign.amountRaised).to.equal(0);
  });

  it("rejects campaign creation with invalid deadline", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) - 1);

    await expect(crowdfunding.connect(creator).createCampaign("Past", ethers.parseEther("1"), deadline)).to.be.revertedWithCustomError(
      crowdfunding,
      "InvalidDeadline"
    );
  });

  it("rejects campaign creation with zero goal", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await expect(crowdfunding.connect(creator).createCampaign("Zero", 0, deadline)).to.be.revertedWithCustomError(crowdfunding, "InvalidGoal");
  });

  it("accepts campaign creation at max duration boundary", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 365 * 24 * 60 * 60);

    await expect(crowdfunding.connect(creator).createCampaign("BoundaryDuration", ethers.parseEther("1"), deadline))
      .to.emit(crowdfunding, "CampaignCreated");
  });

  it("rejects campaign creation above max duration", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 365 * 24 * 60 * 60 + 120);

    await expect(crowdfunding.connect(creator).createCampaign("TooLong", ethers.parseEther("1"), deadline)).to.be.revertedWithCustomError(
      crowdfunding,
      "CampaignDurationTooLong"
    );
  });

  it("accepts donations before deadline", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await crowdfunding.connect(creator).createCampaign("PC", ethers.parseEther("2"), deadline);

    await expect(crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("0.5") }))
      .to.emit(crowdfunding, "DonationReceived")
      .withArgs(0, donor.address, ethers.parseEther("0.5"));

    const campaign = await crowdfunding.campaigns(0);
    expect(campaign.amountRaised).to.equal(ethers.parseEther("0.5"));
    expect(await crowdfunding.contributions(0, donor.address)).to.equal(ethers.parseEther("0.5"));
  });

  it("rejects donations of zero value", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await crowdfunding.connect(creator).createCampaign("Speaker", ethers.parseEther("2"), deadline);

    await expect(crowdfunding.connect(donor).donate(0, { value: 0 })).to.be.revertedWithCustomError(
      crowdfunding,
      "DonationMustBeGreaterThanZero"
    );
  });

  it("rejects donation when deadline is reached", async function () {
    const connection = await network.connect();
    const { ethers, networkHelpers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await crowdfunding.connect(creator).createCampaign("Boundary", ethers.parseEther("2"), deadline);
    await networkHelpers.time.setNextBlockTimestamp(Number(deadline));

    await expect(crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("0.1") })).to.be.revertedWithCustomError(
      crowdfunding,
      "CampaignEnded"
    );
  });

  it("aggregates donations from multiple donors", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor, other } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await crowdfunding.connect(creator).createCampaign("Group", ethers.parseEther("3"), deadline);
    await crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("1") });
    await crowdfunding.connect(other).donate(0, { value: ethers.parseEther("0.75") });

    const campaign = await crowdfunding.campaigns(0);
    expect(campaign.amountRaised).to.equal(ethers.parseEther("1.75"));
    expect(await crowdfunding.contributions(0, donor.address)).to.equal(ethers.parseEther("1"));
    expect(await crowdfunding.contributions(0, other.address)).to.equal(ethers.parseEther("0.75"));
  });

  it("allows creator to withdraw when goal is reached", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);
    const goal = ethers.parseEther("1");

    await crowdfunding.connect(creator).createCampaign("Camera", goal, deadline);
    await crowdfunding.connect(donor).donate(0, { value: goal });
    await increaseTime(connection, 4000);

    await expect(crowdfunding.connect(creator).withdraw(0))
      .to.emit(crowdfunding, "FundsWithdrawn")
      .withArgs(0, creator.address, goal);

    const campaign = await crowdfunding.campaigns(0);
    expect(campaign.withdrawn).to.equal(true);
  });

  it("rejects withdraw by non-creator", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);
    const goal = ethers.parseEther("1");

    await crowdfunding.connect(creator).createCampaign("Bike", goal, deadline);
    await crowdfunding.connect(donor).donate(0, { value: goal });
    await increaseTime(connection, 4000);

    await expect(crowdfunding.connect(donor).withdraw(0)).to.be.revertedWithCustomError(crowdfunding, "NotCampaignCreator");
  });

  it("rejects withdraw before deadline even if goal reached", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);
    const goal = ethers.parseEther("1");

    await crowdfunding.connect(creator).createCampaign("Early", goal, deadline);
    await crowdfunding.connect(donor).donate(0, { value: goal });

    await expect(crowdfunding.connect(creator).withdraw(0)).to.be.revertedWithCustomError(crowdfunding, "CampaignStillActive");
  });

  it("rejects withdraw when goal is not reached", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await crowdfunding.connect(creator).createCampaign("Shortfall", ethers.parseEther("2"), deadline);
    await crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("1") });
    await increaseTime(connection, 4000);

    await expect(crowdfunding.connect(creator).withdraw(0)).to.be.revertedWithCustomError(crowdfunding, "GoalNotReached");
  });

  it("rejects second withdraw attempt", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);
    const goal = ethers.parseEther("1");

    await crowdfunding.connect(creator).createCampaign("SingleWithdraw", goal, deadline);
    await crowdfunding.connect(donor).donate(0, { value: goal });
    await increaseTime(connection, 4000);
    await crowdfunding.connect(creator).withdraw(0);

    await expect(crowdfunding.connect(creator).withdraw(0)).to.be.revertedWithCustomError(crowdfunding, "AlreadyWithdrawn");
  });

  it("allows refund when goal is not reached and deadline passed", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 100);

    await crowdfunding.connect(creator).createCampaign("Trip", ethers.parseEther("2"), deadline);
    await crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("0.4") });

    await increaseTime(connection, 500);

    await expect(crowdfunding.connect(donor).refund(0))
      .to.emit(crowdfunding, "RefundIssued")
      .withArgs(0, donor.address, ethers.parseEther("0.4"));

    expect(await crowdfunding.contributions(0, donor.address)).to.equal(0);
  });

  it("rejects refund when goal was reached", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 100);
    const goal = ethers.parseEther("1");

    await crowdfunding.connect(creator).createCampaign("Game", goal, deadline);
    await crowdfunding.connect(donor).donate(0, { value: goal });

    await increaseTime(connection, 500);

    await expect(crowdfunding.connect(donor).refund(0)).to.be.revertedWithCustomError(crowdfunding, "GoalAlreadyReached");
  });

  it("rejects refund while campaign is still active", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await crowdfunding.connect(creator).createCampaign("ActiveRefund", ethers.parseEther("2"), deadline);
    await crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("0.4") });

    await expect(crowdfunding.connect(donor).refund(0)).to.be.revertedWithCustomError(crowdfunding, "CampaignStillActive");
  });

  it("rejects refund when caller has no contribution", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor, other } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 100);

    await crowdfunding.connect(creator).createCampaign("NoContribution", ethers.parseEther("2"), deadline);
    await crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("0.4") });
    await increaseTime(connection, 500);

    await expect(crowdfunding.connect(other).refund(0)).to.be.revertedWithCustomError(crowdfunding, "NoContributionToRefund");
  });

  it("reverts with CampaignNotFound for invalid campaign id", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const invalidId = 99;

    await expect(crowdfunding.connect(donor).donate(invalidId, { value: ethers.parseEther("0.1") })).to.be.revertedWithCustomError(
      crowdfunding,
      "CampaignNotFound"
    );
    await expect(crowdfunding.connect(creator).withdraw(invalidId)).to.be.revertedWithCustomError(crowdfunding, "CampaignNotFound");
    await expect(crowdfunding.connect(donor).refund(invalidId)).to.be.revertedWithCustomError(crowdfunding, "CampaignNotFound");
  });

  it("sets owner at deployment and allows ownership transfer", async function () {
    const connection = await network.connect();
    const { crowdfunding, creator, other } = await deployFixture(connection);

    expect(await crowdfunding.owner()).to.equal(creator.address);
    await expect(crowdfunding.connect(creator).transferOwnership(other.address))
      .to.emit(crowdfunding, "OwnershipTransferred")
      .withArgs(creator.address, other.address);
    expect(await crowdfunding.owner()).to.equal(other.address);
  });

  it("rejects ownership transfer by non-owner", async function () {
    const connection = await network.connect();
    const { crowdfunding, donor, other } = await deployFixture(connection);

    await expect(crowdfunding.connect(donor).transferOwnership(other.address)).to.be.revertedWithCustomError(crowdfunding, "NotOwner");
  });

  it("allows owner to recover stuck funds", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);

    await donor.sendTransaction({
      to: await crowdfunding.getAddress(),
      value: ethers.parseEther("0.01")
    });

    await expect(crowdfunding.connect(creator).recoverStuckFunds(creator.address, ethers.parseEther("0.01")))
      .to.emit(crowdfunding, "StuckFundsRecovered")
      .withArgs(creator.address, creator.address, ethers.parseEther("0.01"));
  });

  it("rejects stuck funds recovery by non-owner", async function () {
    const connection = await network.connect();
    const { crowdfunding, donor } = await deployFixture(connection);

    await expect(crowdfunding.connect(donor).recoverStuckFunds(donor.address, 1n)).to.be.revertedWithCustomError(crowdfunding, "NotOwner");
  });

  it("rejects owner recovery of tracked campaign funds", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await crowdfunding.connect(creator).createCampaign("Tracked", ethers.parseEther("2"), deadline);
    await crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("0.5") });

    await expect(crowdfunding.connect(creator).recoverStuckFunds(creator.address, ethers.parseEther("0.1"))).to.be.revertedWithCustomError(
      crowdfunding,
      "InsufficientRecoverableFunds"
    );
  });

  it("allows owner to recover only excess funds beyond tracked balance", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await crowdfunding.connect(creator).createCampaign("Mix", ethers.parseEther("2"), deadline);
    await crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("0.5") });

    await donor.sendTransaction({
      to: await crowdfunding.getAddress(),
      value: ethers.parseEther("0.02")
    });

    await expect(crowdfunding.connect(creator).recoverStuckFunds(creator.address, ethers.parseEther("0.02")))
      .to.emit(crowdfunding, "StuckFundsRecovered")
      .withArgs(creator.address, creator.address, ethers.parseEther("0.02"));

    await expect(crowdfunding.connect(creator).recoverStuckFunds(creator.address, 1n)).to.be.revertedWithCustomError(
      crowdfunding,
      "InsufficientRecoverableFunds"
    );
  });

  it("maintains balance invariant: balance >= totalTrackedFunds", async function () {
    const connection = await network.connect();
    const { ethers } = connection;
    const { crowdfunding, creator, donor, other } = await deployFixture(connection);
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    const assertInvariant = async () => {
      const tracked = await crowdfunding.totalTrackedFunds();
      const balance = await ethers.provider.getBalance(await crowdfunding.getAddress());
      expect(balance).to.be.gte(tracked);
    };

    await assertInvariant();

    await crowdfunding.connect(creator).createCampaign("Inv1", ethers.parseEther("1"), deadline);
    await assertInvariant();

    await crowdfunding.connect(donor).donate(0, { value: ethers.parseEther("0.4") });
    await assertInvariant();

    await other.sendTransaction({
      to: await crowdfunding.getAddress(),
      value: ethers.parseEther("0.02")
    });
    await assertInvariant();

    await increaseTime(connection, 4000);
    await crowdfunding.connect(donor).refund(0);
    await assertInvariant();

    await crowdfunding.connect(creator).recoverStuckFunds(creator.address, ethers.parseEther("0.02"));
    await assertInvariant();
  });
});
