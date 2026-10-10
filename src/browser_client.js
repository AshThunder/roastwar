import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";
import { parseEther, formatEther } from "viem";

window.GenLayer = {
  createClient,
  studionet,
  privateKeyToAccount,
  parseEther,
  formatEther
};
