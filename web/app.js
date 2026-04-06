const AMOY_CHAIN_ID_HEX = "0x13882";
const LOCAL_CHAIN_ID = 31337;
const CONTRACT_ADDRESSES = {
  [LOCAL_CHAIN_ID]: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  80002: "0xe4F3C18C83DFF756212981DCeDbA9Ad8902e7fd5"               // Solo para Amoy
};

const CROWDFUNDING_ABI = [
  "function campaignCount() view returns (uint256)",
  "function getCampaigns() view returns (tuple(address creator,string title,uint256 goal,uint256 deadline,uint256 amountRaised,bool withdrawn,bool exists)[])",
  "function createCampaign(string calldata title, uint256 goal, uint256 deadline) external returns (uint256)",
  "function donate(uint256 campaignId) external payable"
];

const state = {
  provider: null,
  signer: null,
  contract: null,
  account: null
};

const ui = {
  connectBtn: document.getElementById("connectBtn"),
  switchAmoyBtn: document.getElementById("switchAmoyBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  createCampaignBtn: document.getElementById("createCampaignBtn"),
  makeADonationBtn: document.getElementById("makeADonationBtn"),
  account: document.getElementById("account"),
  network: document.getElementById("network"),
  statusText: document.getElementById("statusText"),
  campaignTitle: document.getElementById("campaignTitle"),
  campaignGoal: document.getElementById("campaignGoal"),
  campaignDeadline: document.getElementById("campaignDeadline"),
  campaignDescription: document.getElementById("campaignDescription"),
  campaignSelector: document.getElementById("campaignSelector"),
  donationAmount: document.getElementById("donationAmount"),
  campaignList: document.getElementById("campaignList")
};

function setStatus(message, isError = false) {
  ui.statusText.textContent = message;
  ui.statusText.classList.toggle("error", isError);
}

function shortenAddress(address) {
  if (!address || address.length < 12) return address || "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestampSeconds) {
  const date = new Date(Number(timestampSeconds) * 1000);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function updateNetworkLabel() {
  if (!state.provider) {
    ui.network.textContent = "Unknown";
    return;
  }

  const network = await state.provider.getNetwork();
  const chainId = Number(network.chainId);
  const label = chainId === LOCAL_CHAIN_ID
    ? "Hardhat Local (31337)"
    : chainId === 80002
      ? "Polygon Amoy (80002)"
      : `${network.name} (${chainId})`;
  ui.network.textContent = label;
}

async function connectWallet() {
  if (!window.ethereum) {
    setStatus("MetaMask not found. Install MetaMask first.", true);
    return;
  }

  state.provider = new ethers.BrowserProvider(window.ethereum);
  await state.provider.send("eth_requestAccounts", []);
  state.signer = await state.provider.getSigner();
  state.account = await state.signer.getAddress();

  ui.account.textContent = shortenAddress(state.account);
  await updateNetworkLabel();
  setStatus("Wallet connected.");
}

async function loadContract() {
  if (!state.signer) {
    await connectWallet();
  }

  const network = await state.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (![LOCAL_CHAIN_ID, 80002].includes(chainId)) {
    throw new Error(`Unsupported network. Connect MetaMask to local Hardhat (chainId ${LOCAL_CHAIN_ID}) or Polygon Amoy (chainId 80002). Current chainId: ${chainId}`);
  }

  const contractAddress = CONTRACT_ADDRESSES[chainId];
  if (!contractAddress || !ethers.isAddress(contractAddress)) {
    throw new Error(`No valid contract address found for chainId ${chainId}.`);
  }

  state.contract = new ethers.Contract(contractAddress, CROWDFUNDING_ABI, state.signer);
}

async function switchToAmoy() {
  if (!window.ethereum) {
    setStatus("MetaMask not found. Install MetaMask first.", true);
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY_CHAIN_ID_HEX }]
    });
    if (state.provider) {
      await updateNetworkLabel();
      state.contract = null;
      clearCampaigns();
    }
    setStatus("Switched to Polygon Amoy.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to switch network.", true);
  }
}

async function ensureConnected() {
  if (!state.signer) {
    await connectWallet();
  }
  if (!state.contract) {
    await loadContract();
  }
}

function parseDeadline() {
  const dateValue = ui.campaignDeadline.value;
  if (!dateValue) {
    throw new Error("Choose a deadline date.");
  }

  const deadline = new Date(`${dateValue}T23:59:59Z`);
  if (Number.isNaN(deadline.getTime())) {
    throw new Error("Invalid deadline date.");
  }

  const timestamp = Math.floor(deadline.getTime() / 1000);
  if (timestamp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Deadline must be in the future.");
  }

  return timestamp;
}

async function createCampaign() {
  try {
    await ensureConnected();

    const title = ui.campaignTitle.value.trim();
    const goalValue = ui.campaignGoal.value.trim();
    const deadline = parseDeadline();

    if (!title) {
      throw new Error("Campaign title is required.");
    }
    if (!goalValue) {
      throw new Error("Campaign goal is required.");
    }

    const goal = ethers.parseEther(goalValue);
    if (goal <= 0n) {
      throw new Error("Campaign goal must be greater than 0.");
    }

    setStatus("Creating campaign...");
    const tx = await state.contract.createCampaign(title, goal, deadline, {
      gasLimit: 500000,
      gasPrice: ethers.parseUnits("25", "gwei")
    });
    await tx.wait();

    ui.campaignTitle.value = "";
    ui.campaignGoal.value = "";
    ui.campaignDeadline.value = "";
    ui.campaignDescription.value = "";

    setStatus("Campaign created successfully.");
    await renderCampaigns();
  } catch (error) {
    console.error(error);
    setStatus(error.reason || error.message, true);
  }
}

async function donate() {
  try {
    await ensureConnected();

    const campaignId = ui.campaignSelector.value;
    const amountValue = ui.donationAmount.value.trim();

    if (!campaignId) {
      throw new Error("Select a campaign to donate to.");
    }
    if (!amountValue) {
      throw new Error("Enter an amount to donate.");
    }

    const value = ethers.parseEther(amountValue);
    if (value <= 0n) {
      throw new Error("Donation amount must be greater than 0.");
    }

    setStatus(`Donating ${amountValue} ETH to campaign #${campaignId}...`);
    const tx = await state.contract.donate(campaignId, {
      value,
      gasLimit: 300000,
      gasPrice: ethers.parseUnits("25", "gwei")
    });
    await tx.wait();

    ui.donationAmount.value = "";
    setStatus("Donation confirmed.");
    await renderCampaigns();
  } catch (error) {
    console.error(error);
    setStatus(error.reason || error.message, true);
  }
}

function clearCampaigns() {
  ui.campaignList.innerHTML = "";
  ui.campaignSelector.innerHTML = "<option value=\"\">No campaigns loaded</option>";
}

async function renderCampaigns() {
  try {
    await ensureConnected();
    const campaigns = await state.contract.getCampaigns();

    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      clearCampaigns();
      ui.campaignSelector.innerHTML = "<option value=\"\">No campaigns available</option>";
      return;
    }

    ui.campaignList.innerHTML = "";
    ui.campaignSelector.innerHTML = "<option value=\"\">Select a campaign</option>";

    campaigns.forEach((campaign, index) => {
      const card = document.createElement("div");
      card.className = "candidate";

      const titleEl = document.createElement("strong");
      titleEl.textContent = `#${index} ${campaign.title}`;

      const creatorEl = document.createElement("p");
      creatorEl.textContent = `Creator: ${shortenAddress(campaign.creator)}`;

      const goalEl = document.createElement("p");
      goalEl.textContent = `Goal: ${ethers.formatEther(campaign.goal)} ETH`;

      const raisedEl = document.createElement("p");
      raisedEl.textContent = `Raised: ${ethers.formatEther(campaign.amountRaised)} ETH`;

      const deadlineEl = document.createElement("p");
      deadlineEl.textContent = `Deadline: ${formatDate(campaign.deadline)}`;

      const statusEl = document.createElement("p");
      const withdrawn = campaign.withdrawn;
      statusEl.textContent = withdrawn ? "Status: Withdrawn" : "Status: Active";

      card.appendChild(titleEl);
      card.appendChild(creatorEl);
      card.appendChild(goalEl);
      card.appendChild(raisedEl);
      card.appendChild(deadlineEl);
      card.appendChild(statusEl);
      ui.campaignList.appendChild(card);

      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `#${index} ${campaign.title}`;
      ui.campaignSelector.appendChild(option);
    });
  } catch (error) {
    clearCampaigns();
    setStatus(error.reason || error.message, true);
  }
}

function bindEvents() {
  ui.connectBtn.addEventListener("click", async () => {
    await connectWallet();
    await renderCampaigns();
  });
  ui.switchAmoyBtn.addEventListener("click", switchToAmoy);
  ui.refreshBtn.addEventListener("click", async () => {
    try {
      await updateNetworkLabel();
      await renderCampaigns();
      setStatus("Refreshed.");
    } catch (error) {
      setStatus(error.reason || error.message, true);
    }
  });
  ui.createCampaignBtn.addEventListener("click", createCampaign);
  ui.makeADonationBtn.addEventListener("click", donate);

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async () => {
      state.signer = null;
      state.account = null;
      state.contract = null;
      ui.account.textContent = "Not connected";
      clearCampaigns();
      setStatus("Account changed. Reconnect wallet.");
    });

    window.ethereum.on("chainChanged", async () => {
      await updateNetworkLabel();
      state.contract = null;
      clearCampaigns();
      setStatus("Network changed.");
    });
  }
}

function init() {
  clearCampaigns();
  bindEvents();
  setStatus("Ready");
}

init();
