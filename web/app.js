const AMOY_CHAIN_ID_HEX = "0x13882";
const LOCAL_CHAIN_ID = 31337;
const AMOY_CHAIN_ID = 80002;
const STORAGE_KEY_PREFIX = "crowdblock_contract_";
const PAGE_SIZE = 5;

const DEFAULT_CONTRACT_ADDRESSES = {
  [LOCAL_CHAIN_ID]: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  [AMOY_CHAIN_ID]: "0xb23d06c33a3faA5e092FFA315e6e4ab87E4983BB"
};

const CROWDFUNDING_ABI = [
  "function campaignCount() view returns (uint256)",
  "function owner() view returns (address)",
  "function getCampaigns() view returns (tuple(address creator,string title,uint256 goal,uint256 deadline,uint256 amountRaised,bool withdrawn,bool exists)[])",
  "function getDonators(uint256 campaignId) view returns (address[])",
  "function contributions(uint256 campaignId, address donor) view returns (uint256)",
  "function createCampaign(string calldata title, uint256 goal, uint256 deadline) external returns (uint256)",
  "function donate(uint256 campaignId) external payable",
  "function withdraw(uint256 campaignId) external",
  "function refund(uint256 campaignId) external",
  "function transferOwnership(address newOwner) external",
  "function recoverStuckFunds(address to, uint256 amount) external"
];

const state = {
  provider: null,
  signer: null,
  contract: null,
  account: null,
  chainId: null,
  contractAddress: null,
  ownerAddress: null,
  isOwner: false,
  currentPage: 1
};

const ui = {
  connectBtn: document.getElementById("connectBtn"),
  switchAmoyBtn: document.getElementById("switchAmoyBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  loadContractBtn: document.getElementById("loadContractBtn"),
  resetUiBtn: document.getElementById("resetUiBtn"),
  createCampaignBtn: document.getElementById("createCampaignBtn"),
  makeADonationBtn: document.getElementById("makeADonationBtn"),
  account: document.getElementById("account"),
  network: document.getElementById("network"),
  statusText: document.getElementById("statusText"),
  contractAddress: document.getElementById("contractAddress"),
  ownerAddress: document.getElementById("ownerAddress"),
  ownerRole: document.getElementById("ownerRole"),
  newOwnerAddress: document.getElementById("newOwnerAddress"),
  transferOwnerBtn: document.getElementById("transferOwnerBtn"),
  recoverToAddress: document.getElementById("recoverToAddress"),
  recoverAmount: document.getElementById("recoverAmount"),
  recoverFundsBtn: document.getElementById("recoverFundsBtn"),
  campaignTitle: document.getElementById("campaignTitle"),
  campaignGoal: document.getElementById("campaignGoal"),
  campaignDeadline: document.getElementById("campaignDeadline"),
  campaignSelector: document.getElementById("campaignSelector"),
  donationAmount: document.getElementById("donationAmount"),
  campaignList: document.getElementById("campaignList"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInfo: document.getElementById("pageInfo")
};

function setStatus(message, isError = false) {
  ui.statusText.textContent = message;
  ui.statusText.classList.toggle("error", isError);
}

function setOwnerLabel(address) {
  ui.ownerAddress.textContent = address ? shortenAddress(address) : "No cargado";
}

function updateOwnerUi() {
  if (!state.ownerAddress || !state.account) {
    state.isOwner = false;
    ui.ownerRole.textContent = "No verificado";
  } else {
    state.isOwner = state.ownerAddress.toLowerCase() === state.account.toLowerCase();
    ui.ownerRole.textContent = state.isOwner ? "Owner conectado" : "Cuenta sin permisos de owner";
  }

  ui.transferOwnerBtn.disabled = !state.isOwner;
  ui.recoverFundsBtn.disabled = !state.isOwner;
}

function extractErrorText(error) {
  const parts = [
    error?.reason,
    error?.shortMessage,
    error?.message,
    error?.data?.message,
    error?.error?.message
  ].filter(Boolean);
  return parts.join(" | ");
}

function extractErrorSelector(error) {
  const candidates = [
    error?.data,
    error?.error?.data,
    error?.info?.error?.data,
    error?.info?.payload?.error?.data
  ];

  for (const value of candidates) {
    if (typeof value === "string" && /^0x[0-9a-fA-F]{8}/.test(value)) {
      return value.slice(0, 10).toLowerCase();
    }
  }

  return null;
}

function getFriendlyError(error, fallback) {
  const raw = extractErrorText(error);
  const selector = extractErrorSelector(error);

  const map = [
    ["NotOwner", "Solo el owner puede ejecutar esta acción."],
    ["NotCampaignCreator", "Solo el creador de la campaña puede retirar fondos."],
    ["CampaignStillActive", "La campaña sigue activa. Aún no se cumple el deadline."],
    ["GoalNotReached", "No se puede retirar: la meta no fue alcanzada."],
    ["GoalAlreadyReached", "No se puede reembolsar: la meta ya fue alcanzada."],
    ["NoContributionToRefund", "No tienes aportes para reembolsar en esta campaña."],
    ["AlreadyWithdrawn", "Los fondos de esta campaña ya fueron retirados."],
    ["CampaignEnded", "No se puede donar: la campaña ya finalizó."],
    ["CampaignNotFound", "La campaña no existe."],
    ["InvalidDeadline", "Fecha límite inválida."],
    ["InvalidGoal", "Meta inválida."]
  ];

  if (raw) {
    for (const [token, message] of map) {
      if (raw.includes(token)) return message;
    }
  }

  const selectorMap = new Map([
    ["0x30cd7471", "Solo el owner puede ejecutar esta acción."],
    ["0xe681a15c", "Solo el creador de la campaña puede retirar fondos."],
    ["0x9cb6acb6", "La campaña sigue activa. Aún no se cumple el deadline."],
    ["0x78c754c9", "No se puede retirar: la meta no fue alcanzada."],
    ["0x8cb8251e", "No se puede reembolsar: la meta ya fue alcanzada."],
    ["0xc696cfea", "No tienes aportes para reembolsar en esta campaña."],
    ["0x6507689f", "Los fondos de esta campaña ya fueron retirados."],
    ["0x553ae054", "No se puede donar: la campaña ya finalizó."],
    ["0x6ff36e16", "La campaña no existe."],
    ["0x769d11e4", "Fecha límite inválida."],
    ["0x9b60eb4d", "Meta inválida."],
    ["0x4368db74", "El monto de donación debe ser mayor a 0."],
    ["0x49e27cff", "Dirección de owner inválida."],
    ["0x9c8d2cd2", "Dirección destino inválida."],
    ["0x5162a56f", "No hay fondos recuperables suficientes para esa operación."],
    ["0x90b8ec18", "La transferencia de fondos falló en la red."]
  ]);

  if (selector && selectorMap.has(selector)) {
    return selectorMap.get(selector);
  }

  if (!raw) return fallback;

  if (raw.includes("missing revert data") || raw.includes("CALL_EXCEPTION")) {
    return "La transacción fue rechazada por una validación del contrato. Revisa permisos, deadline y condiciones de la campaña.";
  }

  if (raw.includes("estimateGas")) {
    return "No se pudo estimar gas para la transacción. Verifica los datos y el estado actual de la campaña.";
  }

  return raw || fallback;
}

function shortenAddress(address) {
  if (!address || address.length < 12) return address || "No conectada";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestampSeconds) {
  const date = new Date(Number(timestampSeconds) * 1000);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getStoredAddress(chainId) {
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${chainId}`) || "";
}

function setStoredAddress(chainId, address) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${chainId}`, address);
}

function clearStoredAddresses() {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

function getDefaultAddress(chainId) {
  return DEFAULT_CONTRACT_ADDRESSES[chainId] || "";
}

function syncAddressInput(chainId) {
  const stored = getStoredAddress(chainId);
  const fallback = getDefaultAddress(chainId);
  ui.contractAddress.value = stored || fallback;
}

async function updateNetworkLabel() {
  if (!state.provider) {
    ui.network.textContent = "Desconocida";
    return;
  }

  const network = await state.provider.getNetwork();
  const chainId = Number(network.chainId);
  state.chainId = chainId;

  const label = chainId === LOCAL_CHAIN_ID
    ? "Hardhat Local (31337)"
    : chainId === AMOY_CHAIN_ID
      ? "Polygon Amoy (80002)"
      : `${network.name} (${chainId})`;

  ui.network.textContent = label;
  syncAddressInput(chainId);
}

async function connectWallet() {
  if (!window.ethereum) {
    setStatus("MetaMask no encontrado. Instala MetaMask.", true);
    return;
  }

  state.provider = new ethers.BrowserProvider(window.ethereum);
  await state.provider.send("eth_requestAccounts", []);
  state.signer = await state.provider.getSigner();
  state.account = await state.signer.getAddress();

  ui.account.textContent = shortenAddress(state.account);
  await updateNetworkLabel();
  updateOwnerUi();
  setStatus("Wallet conectada.");
}

function resolveContractAddress(chainId) {
  const inputAddress = ui.contractAddress.value.trim();
  const fallback = getDefaultAddress(chainId);
  const selected = inputAddress || fallback;

  if (!selected || !ethers.isAddress(selected)) {
    throw new Error(`Dirección de contrato inválida para chainId ${chainId}.`);
  }

  setStoredAddress(chainId, selected);
  return selected;
}

async function loadContract() {
  if (!state.signer) {
    await connectWallet();
  }

  const network = await state.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (![LOCAL_CHAIN_ID, AMOY_CHAIN_ID].includes(chainId)) {
    throw new Error(`Red no soportada. Usa Hardhat local (${LOCAL_CHAIN_ID}) o Amoy (${AMOY_CHAIN_ID}).`);
  }

  const contractAddress = resolveContractAddress(chainId);
  const candidate = new ethers.Contract(contractAddress, CROWDFUNDING_ABI, state.signer);
  try {
    const [owner] = await Promise.all([candidate.owner(), candidate.campaignCount()]);
    state.contract = candidate;
    state.ownerAddress = owner;
  } catch (_) {
    throw new Error("La dirección no corresponde a un contrato CrowdBlock válido en esta red.");
  }
  state.contractAddress = contractAddress;
  setOwnerLabel(state.ownerAddress);
  updateOwnerUi();
}

async function switchToAmoy() {
  if (!window.ethereum) {
    setStatus("MetaMask no encontrado. Instala MetaMask.", true);
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY_CHAIN_ID_HEX }]
    });
  } catch (error) {
    if (error && error.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: AMOY_CHAIN_ID_HEX,
          chainName: "Polygon Amoy",
          nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
          rpcUrls: ["https://rpc-amoy.polygon.technology"],
          blockExplorerUrls: ["https://amoy.polygonscan.com"]
        }]
      });
    } else {
      throw error;
    }
  }

  if (state.provider) {
    await updateNetworkLabel();
    state.contract = null;
    clearCampaigns();
  }
  setStatus("Red cambiada a Polygon Amoy.");
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
    throw new Error("Selecciona una fecha límite.");
  }

  const deadline = new Date(`${dateValue}T23:59:59Z`);
  if (Number.isNaN(deadline.getTime())) {
    throw new Error("Fecha límite inválida.");
  }

  const timestamp = Math.floor(deadline.getTime() / 1000);
  if (timestamp <= Math.floor(Date.now() / 1000)) {
    throw new Error("La fecha límite debe ser futura.");
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
      throw new Error("El título es requerido.");
    }
    if (!goalValue) {
      throw new Error("La meta es requerida.");
    }

    const goal = ethers.parseEther(goalValue);
    if (goal <= 0n) {
      throw new Error("La meta debe ser mayor a 0.");
    }

    setStatus("Creando campaña...");
    const tx = await state.contract.createCampaign(title, goal, deadline);
    await tx.wait();

    ui.campaignTitle.value = "";
    ui.campaignGoal.value = "";
    ui.campaignDeadline.value = "";

    setStatus("Campaña creada correctamente.");
    await renderCampaigns();
  } catch (error) {
    console.error(error);
    setStatus(getFriendlyError(error, "Error al crear campaña."), true);
  }
}

async function donate() {
  try {
    await ensureConnected();

    const campaignId = ui.campaignSelector.value;
    const amountValue = ui.donationAmount.value.trim();

    if (campaignId === "") {
      throw new Error("Selecciona una campaña.");
    }
    if (!amountValue) {
      throw new Error("Ingresa un monto a donar.");
    }

    const value = ethers.parseEther(amountValue);
    if (value <= 0n) {
      throw new Error("El monto de donación debe ser mayor a 0.");
    }

    setStatus(`Donando ${amountValue} token nativo a campaña #${campaignId}...`);
    const tx = await state.contract.donate(campaignId, { value });
    await tx.wait();

    ui.donationAmount.value = "";
    setStatus("Donación confirmada.");
    await renderCampaigns();
  } catch (error) {
    console.error(error);
    setStatus(getFriendlyError(error, "Error al donar."), true);
  }
}

async function withdrawCampaign(campaignId) {
  try {
    await ensureConnected();
    setStatus(`Retirando fondos de campaña #${campaignId}...`);
    const tx = await state.contract.withdraw(campaignId);
    await tx.wait();
    setStatus("Retiro confirmado.");
    await renderCampaigns();
  } catch (error) {
    console.error(error);
    setStatus(getFriendlyError(error, "Error al retirar."), true);
  }
}

async function refundCampaign(campaignId) {
  try {
    await ensureConnected();
    setStatus(`Solicitando reembolso de campaña #${campaignId}...`);
    const tx = await state.contract.refund(campaignId);
    await tx.wait();
    setStatus("Reembolso confirmado.");
    await renderCampaigns();
  } catch (error) {
    console.error(error);
    setStatus(getFriendlyError(error, "Error al reembolsar."), true);
  }
}

async function transferOwnership() {
  try {
    await ensureConnected();
    const newOwner = ui.newOwnerAddress.value.trim();
    if (!ethers.isAddress(newOwner)) {
      throw new Error("Dirección de nuevo owner inválida.");
    }

    setStatus("Transfiriendo ownership...");
    const tx = await state.contract.transferOwnership(newOwner);
    await tx.wait();
    ui.newOwnerAddress.value = "";
    const owner = await state.contract.owner();
    setOwnerLabel(owner);
    setStatus("Ownership transferido correctamente.");
  } catch (error) {
    console.error(error);
    setStatus(getFriendlyError(error, "Error al transferir owner."), true);
  }
}

async function recoverStuckFunds() {
  try {
    await ensureConnected();
    const to = ui.recoverToAddress.value.trim();
    const amountValue = ui.recoverAmount.value.trim();
    if (!ethers.isAddress(to)) {
      throw new Error("Dirección destino inválida.");
    }
    if (!amountValue) {
      throw new Error("Ingresa un monto.");
    }
    const amount = ethers.parseEther(amountValue);
    if (amount <= 0n) {
      throw new Error("El monto debe ser mayor a 0.");
    }

    setStatus("Recuperando fondos bloqueados...");
    const tx = await state.contract.recoverStuckFunds(to, amount);
    await tx.wait();
    ui.recoverToAddress.value = "";
    ui.recoverAmount.value = "";
    setStatus("Fondos recuperados correctamente.");
  } catch (error) {
    console.error(error);
    setStatus(getFriendlyError(error, "Error al recuperar fondos."), true);
  }
}

function clearCampaigns() {
  ui.campaignList.innerHTML = "";
  ui.campaignSelector.innerHTML = "<option value=\"\">No hay campañas cargadas</option>";
  ui.pageInfo.textContent = "Página 1/1";
  ui.prevPageBtn.disabled = true;
  ui.nextPageBtn.disabled = true;
}

function resetUiState() {
  clearStoredAddresses();

  state.contract = null;
  state.contractAddress = null;
  state.ownerAddress = null;
  state.currentPage = 1;

  ui.contractAddress.value = "";
  ui.newOwnerAddress.value = "";
  ui.recoverToAddress.value = "";
  ui.recoverAmount.value = "";
  ui.campaignTitle.value = "";
  ui.campaignGoal.value = "";
  ui.campaignDeadline.value = "";
  ui.donationAmount.value = "";

  setOwnerLabel("");
  updateOwnerUi();
  clearCampaigns();

  if (state.chainId) {
    syncAddressInput(state.chainId);
  }

  setStatus("UI reiniciada. Dirección de contrato local limpiada.");
}

function campaignStatus(campaign, now) {
  if (campaign.withdrawn) return "Retirada";
  if (campaign.amountRaised >= campaign.goal) return "Meta alcanzada";
  if (now >= Number(campaign.deadline)) return "Finalizada";
  return "Activa";
}

async function getContributionAmounts(campaigns) {
  if (!state.account) {
    return campaigns.map(() => 0n);
  }

  const reads = campaigns.map((_, index) => state.contract.contributions(index, state.account));
  return Promise.all(reads);
}

async function renderCampaigns() {
  try {
    await ensureConnected();
    const campaigns = await state.contract.getCampaigns();

    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      clearCampaigns();
      ui.campaignSelector.innerHTML = "<option value=\"\">No hay campañas disponibles</option>";
      return;
    }

    const total = campaigns.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.currentPage > totalPages) {
      state.currentPage = totalPages;
    }
    if (state.currentPage < 1) {
      state.currentPage = 1;
    }

    const start = (state.currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageCampaigns = campaigns.slice(start, end);

    const contributionAmounts = await getContributionAmounts(pageCampaigns);
    const latestBlock = await state.provider.getBlock("latest");
    const now = Number(latestBlock?.timestamp || 0);

    ui.campaignList.innerHTML = "";
    ui.campaignSelector.innerHTML = "<option value=\"\">Selecciona una campaña</option>";
    ui.pageInfo.textContent = `Página ${state.currentPage}/${totalPages}`;
    ui.prevPageBtn.disabled = state.currentPage <= 1;
    ui.nextPageBtn.disabled = state.currentPage >= totalPages;

    for (let i = 0; i < pageCampaigns.length; i += 1) {
      const campaign = pageCampaigns[i];
      const index = start + i;
      const creatorAddress = (campaign.creator || "").toLowerCase();
      const accountAddress = (state.account || "").toLowerCase();
      const isCreator = creatorAddress === accountAddress;
      const isEnded = now >= Number(campaign.deadline);
      const goalReached = campaign.amountRaised >= campaign.goal;
      const canWithdraw = isCreator && goalReached && !campaign.withdrawn;
      const canRefund = isEnded && !goalReached && contributionAmounts[i] > 0n;

      const card = document.createElement("div");
      card.className = "candidate";

      const titleEl = document.createElement("strong");
      titleEl.textContent = `#${index} ${campaign.title}`;

      const creatorEl = document.createElement("p");
      creatorEl.textContent = `Creador: ${shortenAddress(campaign.creator)}`;

      const goalEl = document.createElement("p");
      goalEl.textContent = `Meta: ${ethers.formatEther(campaign.goal)} token nativo`;

      const raisedEl = document.createElement("p");
      raisedEl.textContent = `Recaudado: ${ethers.formatEther(campaign.amountRaised)} token nativo`;

      const deadlineEl = document.createElement("p");
      deadlineEl.textContent = `Fecha límite: ${formatDate(campaign.deadline)}`;

      const statusEl = document.createElement("p");
      statusEl.textContent = `Estado: ${campaignStatus(campaign, now)}`;

      const contributedEl = document.createElement("p");
      contributedEl.textContent = `Tu aporte: ${ethers.formatEther(contributionAmounts[i])} token nativo`;

      const donatorsEl = document.createElement("p");
      donatorsEl.textContent = "Donadores: cargando...";

      const actions = document.createElement("div");
      actions.className = "actions";

      const withdrawBtn = document.createElement("button");
      withdrawBtn.textContent = "Retirar";
      withdrawBtn.disabled = !canWithdraw;
      if (!canWithdraw) {
        withdrawBtn.classList.add("secondary");
      }
      withdrawBtn.addEventListener("click", () => withdrawCampaign(index));

      const refundBtn = document.createElement("button");
      refundBtn.textContent = "Reembolsar";
      refundBtn.disabled = !canRefund;
      if (!canRefund) {
        refundBtn.classList.add("secondary");
      }
      refundBtn.addEventListener("click", () => refundCampaign(index));

      actions.appendChild(withdrawBtn);
      actions.appendChild(refundBtn);

      card.appendChild(titleEl);
      card.appendChild(creatorEl);
      card.appendChild(goalEl);
      card.appendChild(raisedEl);
      card.appendChild(deadlineEl);
      card.appendChild(statusEl);
      card.appendChild(contributedEl);
      card.appendChild(donatorsEl);
      card.appendChild(actions);
      ui.campaignList.appendChild(card);

      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `#${index} ${campaign.title}`;
      ui.campaignSelector.appendChild(option);

      try {
        const donators = await state.contract.getDonators(index);
        if (!Array.isArray(donators) || donators.length === 0) {
          donatorsEl.textContent = "Donadores: ninguno";
        } else {
          donatorsEl.textContent = `Donadores: ${donators.map(shortenAddress).join(", ")}`;
        }
      } catch (_) {
        donatorsEl.textContent = "Donadores: no disponible";
      }
    }
  } catch (error) {
    clearCampaigns();
    setStatus(getFriendlyError(error, "Error al cargar campañas."), true);
  }
}

function bindEvents() {
  ui.connectBtn.addEventListener("click", async () => {
    try {
      await connectWallet();
      await loadContract();
      await renderCampaigns();
    } catch (error) {
      setStatus(getFriendlyError(error, "Error al conectar wallet/contrato."), true);
    }
  });

  ui.loadContractBtn.addEventListener("click", async () => {
    try {
      await ensureConnected();
      await loadContract();
      setStatus(`Contrato cargado: ${shortenAddress(state.contractAddress)}`);
      await renderCampaigns();
    } catch (error) {
      setStatus(getFriendlyError(error, "Error al cargar contrato."), true);
    }
  });

  ui.switchAmoyBtn.addEventListener("click", async () => {
    try {
      await switchToAmoy();
    } catch (error) {
      console.error(error);
      setStatus(getFriendlyError(error, "Error al cambiar de red."), true);
    }
  });

  ui.refreshBtn.addEventListener("click", async () => {
    try {
      await updateNetworkLabel();
      await renderCampaigns();
      setStatus("Actualizado.");
    } catch (error) {
      setStatus(getFriendlyError(error, "Error al actualizar."), true);
    }
  });

  ui.createCampaignBtn.addEventListener("click", createCampaign);
  ui.makeADonationBtn.addEventListener("click", donate);
  ui.transferOwnerBtn.addEventListener("click", transferOwnership);
  ui.recoverFundsBtn.addEventListener("click", recoverStuckFunds);
  ui.resetUiBtn.addEventListener("click", resetUiState);
  ui.prevPageBtn.addEventListener("click", async () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      await renderCampaigns();
    }
  });
  ui.nextPageBtn.addEventListener("click", async () => {
    state.currentPage += 1;
    await renderCampaigns();
  });

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async () => {
      state.signer = null;
      state.account = null;
      state.contract = null;
      state.ownerAddress = null;
      ui.account.textContent = "No conectada";
      setOwnerLabel("");
      updateOwnerUi();
      clearCampaigns();
      setStatus("Cuenta cambiada. Conecta nuevamente.");
    });

    window.ethereum.on("chainChanged", async () => {
      window.location.reload();
    });
  }
}

function init() {
  clearCampaigns();
  bindEvents();
  setOwnerLabel("");
  updateOwnerUi();

  window.addEventListener("unhandledrejection", (event) => {
    const message = getFriendlyError(event?.reason, "Error inesperado.");
    setStatus(message, true);
  });

  window.addEventListener("error", (event) => {
    const message = getFriendlyError(event?.error || event?.message, "Error inesperado.");
    setStatus(message, true);
  });

  setStatus("Listo");
}

init();
