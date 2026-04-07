import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

function resolveAccounts(privateKey: string) {
  if (!privateKey) {
    return [];
  }

  const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const isValidKey = /^0x[a-fA-F0-9]{64}$/.test(normalized);

  return isValidKey ? [normalized] : [];
}

const amoyRpcUrl = process.env.AMOY_RPC_URL || "";
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || "";

const networks = {
  hardhat: {
    type: "edr-simulated" as const,
    chainId: 31337
  },
  localhost: {
    type: "http" as const,
    url: "http://127.0.0.1:8545",
    chainId: 31337,
    gasPrice: 25000000000,
    gas: 8000000,
  }
};

if (amoyRpcUrl) {
  Object.assign(networks, {
    amoy: {
      type: "http" as const,
      url: amoyRpcUrl,
      accounts: resolveAccounts(deployerPrivateKey)
    }
  });
}

const config = defineConfig({
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha, hardhatNetworkHelpers],
  solidity: "0.8.26",
  networks
});

export default config;
