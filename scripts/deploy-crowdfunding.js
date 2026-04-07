import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadArtifact() {
  const artifactPath = path.join(__dirname, "../artifacts/contracts/Crowdfunding.sol/Crowdfunding.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error("No se encontró el artifact de Crowdfunding. Ejecuta primero: npm run compile");
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

function ensureEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Falta variable de entorno requerida: ${name}`);
  }
  return String(value).trim();
}

function resolvePrivateKey(pk) {
  return pk.startsWith("0x") ? pk : `0x${pk}`;
}

async function main() {
  const artifact = loadArtifact();

  const amoyRpcUrl = ensureEnv("AMOY_RPC_URL");
  const privateKey = resolvePrivateKey(ensureEnv("DEPLOYER_PRIVATE_KEY"));

  const provider = new ethers.JsonRpcProvider(amoyRpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 80002) {
    throw new Error(`RPC no corresponde a Amoy (80002). chainId detectado: ${network.chainId}`);
  }

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(wallet.address);
  const deployTx = contract.deploymentTransaction();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const record = {
    network: "amoy",
    chainId: 80002,
    contract: "Crowdfunding",
    address,
    deployer: wallet.address,
    txHash: deployTx?.hash || null,
    deployedAt: new Date().toISOString()
  };

  const outDir = path.join(__dirname, "../deployments");
  const outFile = path.join(outDir, "amoy-crowdfunding.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2));

  console.log("Crowdfunding desplegado en Amoy:", address);
  console.log("Registro guardado en:", outFile);
  if (record.txHash) {
    console.log("Tx hash:", record.txHash);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
