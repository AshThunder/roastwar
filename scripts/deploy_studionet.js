import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = "0x1052b5c67ac26e29a640e4c3024a5df170ae387ae942a6059a37016f31f4f521";
const account = privateKeyToAccount(privateKey);
const RPC_URL = "https://studio.genlayer.com/api";

const contractPath = path.resolve(process.cwd(), "contracts/roast_wars.py");
const contractCode = new Uint8Array(readFileSync(contractPath));

async function deploy() {
  console.log(`Account Address: ${account.address}`);
  const client = createClient({
    chain: {
      ...studionet,
      rpcUrls: {
        default: { http: [RPC_URL] },
        public: { http: [RPC_URL] },
      }
    },
    transport: RPC_URL,
    account: account
  });

  console.log("Initializing consensus smart contract...");
  await client.initializeConsensusSmartContract();

  console.log("Deploying RoastWars contract to StudioNet...");
  const deployHash = await client.deployContract({
    code: contractCode,
    args: [],
  });
  console.log(`Deploy Transaction Hash: ${deployHash}`);

  console.log("Waiting for transaction receipt (ACCEPTED status)...");
  const receipt = await client.waitForTransactionReceipt({
    hash: deployHash,
    status: "ACCEPTED",
    retries: 200,
  });

  console.log("Raw Receipt:", JSON.stringify(receipt, null, 2));

  const deployedAddress = receipt.data?.contract_address || receipt.contractAddress;
  console.log(`Deployed Address: ${deployedAddress}`);

  if (deployedAddress) {
    const info = {
      network: "studionet",
      chainId: 61999,
      rpcUrl: RPC_URL,
      contractAddress: deployedAddress,
      deployTxHash: deployHash,
      deployer: account.address,
      deployedAt: new Date().toISOString()
    };
    writeFileSync("deployed_address.json", JSON.stringify(info, null, 2));
    console.log("Saved deployed_address.json successfully!");
  }
}

deploy().catch(err => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
