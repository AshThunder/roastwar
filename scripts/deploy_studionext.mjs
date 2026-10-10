import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.PRIVATE_KEY || "0x7d8fcfb7d83c869cd0bb3097062b1e798ea1a4c18a500e6bff5de4d56c1163db";
const account = privateKeyToAccount(privateKey);

const contractPath = "/home/michael/tweet/roast-wars/contracts/roast_wars.py";
const contractCode = new Uint8Array(readFileSync(contractPath));

async function main() {
  console.log("\n=======================================================");
  console.log("🚀 Deploying RoastWars to Studio-Next (studio-dev)");
  console.log("=======================================================");
  console.log(`Deployer Address: ${account.address}`);

  const rpcUrl = "https://studio-next.genlayer.com/api";
  const chainId = 61997;

  const client = createClient({
    chain: {
      ...studionet,
      id: chainId,
      name: "GenLayer Studio Devnet",
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
    },
    transport: rpcUrl,
    account: account,
  });

  try {
    console.log("Checking chain ID...");
    const currentChainId = await client.getChainId();
    console.log(`Connected to Chain ID: ${currentChainId}`);

    console.log("Initiating contract deployment...");
    const deployTx = await client.deployContract({
      code: contractCode,
      args: [],
    });
    console.log(`✅ Deploy Transaction Hash: ${deployTx}`);

    console.log("Waiting for transaction receipt (ACCEPTED status)...");
    const receipt = await client.waitForTransactionReceipt({
      hash: deployTx,
      status: "ACCEPTED",
      retries: 200,
      interval: 3000,
    });

    console.log("Transaction Receipt Status:", receipt.status);

    const executionResult = receipt.consensus_data?.leader_receipt?.[0]?.execution_result;
    console.log("Execution Result:", executionResult || "N/A");

    if (executionResult && executionResult === "ERROR") {
      console.error("Execution error:", receipt.consensus_data?.leader_receipt?.[0]?.error);
      throw new Error("Contract execution failed during deployment");
    }

    let deployedAddress = receipt.data?.contract_address || receipt.contractAddress;

    if (!deployedAddress && receipt.logs && receipt.logs.length > 0) {
      for (const log of receipt.logs) {
        if (log.topics && log.topics.length > 2) {
          deployedAddress = "0x" + log.topics[2].slice(26);
          break;
        }
      }
    }

    if (!deployedAddress) {
      console.log("Checking receipt fields for contract address:", JSON.stringify(receipt, null, 2));
    }

    console.log("=======================================================");
    console.log(`🎉 ROASTWARS DEPLOYED SUCCESSFULLY ON STUDIO-NEXT!`);
    console.log(`Contract Address: ${deployedAddress}`);
    console.log(`Tx Hash: ${deployTx}`);
    console.log("=======================================================");

    const deploymentInfo = {
      network: "studio-next",
      chainId: chainId,
      rpcUrl: rpcUrl,
      contractAddress: deployedAddress,
      txHash: deployTx,
      deployer: account.address,
      timestamp: new Date().toISOString(),
    };

    writeFileSync(
      "/home/michael/tweet/roast-wars/deployed_address.json",
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("Saved deployment info to /home/michael/tweet/roast-wars/deployed_address.json");

    return deployedAddress;
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main();
