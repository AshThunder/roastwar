import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";
import { parseEther } from "viem";
import { readFileSync } from "fs";

const deployed = JSON.parse(readFileSync("deployed_address.json", "utf-8"));
const CONTRACT_ADDRESS = deployed.contractAddress;
const RPC_URL = "https://studio.genlayer.com/api";

const key1 = "0x1052b5c67ac26e29a640e4c3024a5df170ae387ae942a6059a37016f31f4f521";
const account1 = privateKeyToAccount(key1);

const key2 = "0x7d8fcfb7d83c869cd0bb3097062b1e798ea1a4c18a500e6bff5de4d56c1163db";
const account2 = privateKeyToAccount(key2);

const client1 = createClient({
  chain: studionet,
  transport: RPC_URL,
  account: account1,
});

const client2 = createClient({
  chain: studionet,
  transport: RPC_URL,
  account: account2,
});

const pollTransaction = async (client, hash) => {
  console.log(`Polling transaction receipt for: ${hash}`);
  for (let i = 0; i < 200; i++) {
    try {
      const tx = await client.getTransaction({ hash });
      if (tx.statusName === "ACCEPTED" || tx.statusName === "FINALIZED") {
        console.log(`Transaction successfully committed (Status: ${tx.statusName})`);
        return tx;
      }
      if (tx.statusName === "ERROR" || tx.statusName?.includes("ERROR") || tx.statusName === "LEADER_TIMEOUT") {
        throw new Error(`Transaction failed with status: ${tx.statusName}`);
      }
      await new Promise(r => setTimeout(r, 4000));
    } catch (e) {
      if (e.message?.includes("Transaction failed")) throw e;
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  throw new Error("Transaction timeout");
};

async function main() {
  console.log(`Target Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Creator Account: ${account1.address}`);

  const duelsToCreate = [
    {
      topic: "AI Coding Assistants",
      mode: "ROAST",
      punchline: "You generate 500 lines of code just to center a div, and half of them are deprecated hallucinations from 2021.",
      stake: "0.5"
    },
    {
      topic: "Blockchain Developers",
      mode: "COMPLIMENT",
      punchline: "You architect trustless distributed universes where cryptographic elegance and immutable mathematics triumph over chaos.",
      stake: "1.0"
    },
    {
      topic: "Crypto Twitter Influencers",
      mode: "ROAST",
      punchline: "Your entire investment thesis is anime PFPs with laser eyes screaming 'we are so early' while down 99.4% on every single call.",
      stake: "0.25"
    }
  ];

  for (let i = 0; i < duelsToCreate.length; i++) {
    const d = duelsToCreate[i];
    console.log(`\n--- Creating Duel ${i + 1}: [${d.mode}] "${d.topic}" ---`);
    const hash = await client1.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "create_duel",
      args: [d.topic, d.mode, d.punchline],
      value: parseEther(d.stake),
    });
    console.log(`Tx Hash: ${hash}`);
    await pollTransaction(client1, hash);
    console.log(`Duel ${i + 1} confirmed on-chain!`);
  }

  // Check count
  const count = await client1.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_duel_count",
    args: []
  });
  console.log(`\nTotal On-Chain Duels now: ${count}`);

  const allDuels = await client1.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_duels",
    args: [0, Number(count)]
  });
  console.log("All Duels:", JSON.stringify(allDuels, null, 2));
}

main().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
