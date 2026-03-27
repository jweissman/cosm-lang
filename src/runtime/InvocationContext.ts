import { CosmEnv, CosmValue } from "../types";

export type InvocationContext = {
  receiver?: CosmValue;
  env?: CosmEnv;
  currentBlock?: CosmValue;
  methodContext?: {
    name: string;
    ownerToken: string;
  };
};

export function normalizeInvocationContext(
  contextOrReceiver?: InvocationContext | CosmValue,
  env?: CosmEnv,
  currentBlock?: CosmValue,
): InvocationContext {
  if (
    contextOrReceiver
    && typeof contextOrReceiver === "object"
    && (
      "receiver" in contextOrReceiver
      || "env" in contextOrReceiver
      || "currentBlock" in contextOrReceiver
      || "methodContext" in contextOrReceiver
    )
  ) {
    return contextOrReceiver;
  }
  return {
    receiver: contextOrReceiver as CosmValue | undefined,
    env,
    currentBlock,
  };
}
