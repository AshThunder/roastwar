import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";
import { parseEther } from "viem";
import { readFileSync } from "fs";

const deployed = JSON.parse(readFileSync("deployed_address.json", "utf-8"));
const CONTRACT_ADDRESS = deployed.contractAddress;
const RPC_URL = "https://studio.genlayer.com/api";

const key2 = "0x7d8fcfb7d83c869cd0bb3097062b1e798ea1a4c18a500e6bff5de4d56c1163db";
const account2 = privateKeyToAccount(key2);

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
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Challenger: ${account2.address}`);

  // 1. Accept Duel 1
  console.log("\n--- Accepting Duel 1: AI Coding Assistants ---");
  const challengerPunchline = "At least my code actually runs; your git commit history looks like an EEG of someone flatlining during a stack overflow.";
  const acceptHash = await client2.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "accept_duel",
    args: [1, challengerPunchline],
    value: parseEther("0.5"),
  });
  console.log(`Accept Tx Hash: ${acceptHash}`);
  await pollTransaction(client2, acceptHash);
  console.log("Duel 1 is now ACCEPTED!");

  // 2. Judge Duel 1 (AI Consensus)
  console.log("\n--- Summoning GenLayer AI Comedy Jury to Judge Duel 1 ---");
  const judgeHash = await client2.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "judge_duel",
    args: [1],
  });
  console.log(`Judge Tx Hash: ${judgeHash}`);
  await pollTransaction(client2, judgeHash);
  console.log("Duel 1 Judged by AI Consensus!");

  // 3. Inspect final duel state
  const duel1 = await client2.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_duel",
    args: [1],
  });
  console.log("\nFinal Duel 1 Details:", JSON.stringify(duel1, null, 2));
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
