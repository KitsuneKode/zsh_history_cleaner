import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export type PromptDecision = "continue_once" | "continue_trusted" | "cancel";

export function printWarning(historyFilePath: string): void {
  console.log("\nWARNING");
  console.log("This operation rewrites your shell history file.");
  console.log(`Target: ${historyFilePath}`);
  console.log("A timestamped backup is created before any write.");
}

export async function askForConfirmation(): Promise<PromptDecision> {
  const rl = createInterface({ input, output });

  try {
    console.log("\nChoose an option:");
    console.log("1) Proceed this time");
    console.log("2) I understand the risk, trust this file for this user");
    console.log("3) Cancel");

    const answer = (await rl.question("Selection [1/2/3]: ")).trim();

    if (answer === "1") {
      return "continue_once";
    }

    if (answer === "2") {
      return "continue_trusted";
    }

    return "cancel";
  } finally {
    rl.close();
  }
}
