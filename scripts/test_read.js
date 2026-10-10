import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync } from "fs";

const deployed = JSON.parse(readFileSync("deployed_address.json", "utf-8"));
const contractAddress = deployed.contractAddress;

console.log(`Testing readContract on ${contractAddress}...`);

const client = createClient({
  chain: studionet,
  transport: "https://studio.genlayer.com/api",
});

async function main() {
  const count = await client.readContract({
    address: contractAddress,
    functionName: "get_duel_count",
    args: []
  });
  console.log("Duel Count:", count);

  const stats = await client.readContract({
    address: contractAddress,
    functionName: "get_arena_stats",
    args: []
  });
  console.log("Arena Stats:", stats);
}

main().catch(err => {
  console.error("Read failed:", err.message);
  if (err.cause?.data) {
    console.error("Cause data:", JSON.stringify(err.cause.data, null, 2));
  }
  process.exit(1);
});
