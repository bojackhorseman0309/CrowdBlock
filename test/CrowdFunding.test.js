// tests/CrowdFunding.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
// Test suite for the CrowdFunding smart contract
describe("CrowdFunding Contract", function () {
  let crowdfunding;
  let owner;
  let contributor;
// Before each test, deploy a new instance of the CrowdFunding contract
  beforeEach(async function () {
    // Get signers (addresses) for the owner and contributor
    [owner, contributor] = await ethers.getSigners();
// Deploy the CrowdFunding contract
    const CrowdFunding = await ethers.getContractFactory("CrowdFunding");
    crowdfunding = await CrowdFunding.deploy();
  });
// Test case: Deployment of the CrowdFunding contract
  it("Should deploy the contract", async function () {
    // Check if the contract address is not equal to zero (deployment successful)
    expect(crowdfunding.target).to.not.equal(0);
  });
// Test case: Creating a new campaign
  it("Should create a campaign", async function () {
    // Create a new campaign using the owner's address
    await crowdfunding.connect(owner).createCampaign(
      "Test Campaign",
      "Description of the test campaign",
      "https://example.com/image.jpg",
      1000,
      Math.floor(Date.now() / 1000) + 3600
    );
// Retrieve the list of campaigns
    const campaigns = await crowdfunding.getAllCampaigns();
// Check if there is exactly one campaign and its title matches the expected value
    expect(campaigns.length).to.equal(1);
    expect(campaigns[0].title).to.equal("Test Campaign");
  });
// Test case: Contributing to a campaign
  it("Should contribute to a campaign", async function () {
    // Create a new campaign using the owner's address
    await crowdfunding.connect(owner).createCampaign(
      "Test Campaign",
      "Description of the test campaign",
      "https://example.com/image.jpg",
      1000,
      Math.floor(Date.now() / 1000) + 3600
    );
// Contribute to the created campaign using the contributor's address
    await crowdfunding.connect(contributor).contribute(0, { value: 500 });
// Retrieve the total contributions for the campaign
    const totalContributions = await crowdfunding.getTotalContributions(0);
// Check if the total contributions match the expected value
    expect(totalContributions).to.equal(500);
  });
});