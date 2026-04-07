// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract Crowdfunding {
    uint256 public constant MAX_CAMPAIGN_DURATION = 365 days;
    address public owner;
    uint256 public totalTrackedFunds;

    struct Campaign {
        address creator;
        string title;
        uint256 goal;
        uint256 deadline;
        uint256 amountRaised;
        bool withdrawn;
        bool exists;
    }

    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    mapping(uint256 => address[]) private campaignDonators;
    mapping(uint256 => mapping(address => bool)) private hasDonated;

    event CampaignCreated(uint256 indexed campaignId, address indexed creator, uint256 goal, uint256 deadline, string title);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event FundsWithdrawn(uint256 indexed campaignId, address indexed creator, uint256 amount);
    event RefundIssued(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event StuckFundsRecovered(address indexed owner, address indexed to, uint256 amount);

    error InvalidGoal();
    error InvalidDeadline();
    error CampaignDurationTooLong();
    error InvalidOwner();
    error CampaignNotFound();
    error CampaignEnded();
    error CampaignStillActive();
    error DonationMustBeGreaterThanZero();
    error GoalNotReached();
    error GoalAlreadyReached();
    error NotCampaignCreator();
    error AlreadyWithdrawn();
    error NoContributionToRefund();
    error TransferFailed();
    error NotOwner();
    error InvalidRecipient();
    error InsufficientRecoverableFunds();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidOwner();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    receive() external payable {}

    function createCampaign(string calldata title, uint256 goal, uint256 deadline) external returns (uint256 campaignId) {
        if (goal == 0) revert InvalidGoal();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (deadline > block.timestamp + MAX_CAMPAIGN_DURATION) revert CampaignDurationTooLong();

        campaignId = campaignCount;
        campaignCount += 1;

        campaigns[campaignId] = Campaign({
            creator: msg.sender,
            title: title,
            goal: goal,
            deadline: deadline,
            amountRaised: 0,
            withdrawn: false,
            exists: true
        });

        emit CampaignCreated(campaignId, msg.sender, goal, deadline, title);
    }

    function donate(uint256 campaignId) external payable {
        Campaign storage campaign = _getCampaign(campaignId);
        if (block.timestamp >= campaign.deadline) revert CampaignEnded();
        if (msg.value == 0) revert DonationMustBeGreaterThanZero();

        if (!hasDonated[campaignId][msg.sender]) {
            campaignDonators[campaignId].push(msg.sender);
            hasDonated[campaignId][msg.sender] = true;
        }

        campaign.amountRaised += msg.value;
        contributions[campaignId][msg.sender] += msg.value;
        totalTrackedFunds += msg.value;

        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    function withdraw(uint256 campaignId) external {
        Campaign storage campaign = _getCampaign(campaignId);
        if (msg.sender != campaign.creator) revert NotCampaignCreator();
        if (block.timestamp < campaign.deadline) revert CampaignStillActive();
        if (campaign.amountRaised < campaign.goal) revert GoalNotReached();
        if (campaign.withdrawn) revert AlreadyWithdrawn();

        campaign.withdrawn = true;
        uint256 amount = campaign.amountRaised;
        totalTrackedFunds -= amount;

        (bool success, ) = payable(campaign.creator).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FundsWithdrawn(campaignId, campaign.creator, amount);
    }

    function refund(uint256 campaignId) external {
        Campaign storage campaign = _getCampaign(campaignId);
        if (block.timestamp < campaign.deadline) revert CampaignStillActive();
        if (campaign.amountRaised >= campaign.goal) revert GoalAlreadyReached();

        uint256 amount = contributions[campaignId][msg.sender];
        if (amount == 0) revert NoContributionToRefund();

        contributions[campaignId][msg.sender] = 0;
        totalTrackedFunds -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit RefundIssued(campaignId, msg.sender, amount);
    }

    function _getCampaign(uint256 campaignId) internal view returns (Campaign storage campaign) {
        campaign = campaigns[campaignId];
        if (!campaign.exists) revert CampaignNotFound();
    }

    function getRecoverableExcess() external view returns (uint256) {
        return address(this).balance > totalTrackedFunds ? address(this).balance - totalTrackedFunds : 0;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwner();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function recoverStuckFunds(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        uint256 recoverable = address(this).balance > totalTrackedFunds ? address(this).balance - totalTrackedFunds : 0;
        if (amount > recoverable) revert InsufficientRecoverableFunds();
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit StuckFundsRecovered(msg.sender, to, amount);
    }

    function getDonators(uint256 _campaignId) public view returns (address[] memory) {
        _getCampaign(_campaignId); // validate campaign exists
        return campaignDonators[_campaignId];
    }

    function getCampaigns() public view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](campaignCount); // create a new array of length campaignCount
        for (uint256 i = 0; i < campaignCount; i++) {
            allCampaigns[i] = campaigns[i];
        }
        return allCampaigns;
    }
}
