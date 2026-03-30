import { CosmValue } from "../types";
import { CosmStringValue } from "../values/CosmStringValue";

export type HostCapabilityAdapter<TTarget = unknown> = {
  kind: string;
  inspect: (target: TTarget) => string;
  keys: (target: TTarget) => string[];
  has: (target: TTarget, key: string) => boolean;
  get: (target: TTarget, key: string) => CosmValue | undefined;
  set?: (target: TTarget, key: string, value: CosmValue) => CosmValue;
};

export function createHeadersAdapter(): HostCapabilityAdapter<Headers> {
  return {
    kind: "bun.headers",
    inspect: (target) => {
      const entries = Array.from(target.entries()).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ");
      return entries.length > 0 ? `#<HostObject bun.headers ${entries}>` : "#<HostObject bun.headers>";
    },
    keys: (target) => Array.from(target.keys()),
    has: (target, key) => target.has(key),
    get: (target, key) => {
      const value = target.get(key);
      return value === null ? undefined : new CosmStringValue(value);
    },
    set: (target, key, value) => {
      const rendered = value instanceof CosmStringValue ? value.value : value.toCosmString("interpolate");
      target.set(key, rendered);
      return new CosmStringValue(rendered);
    },
  };
}
