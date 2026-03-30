import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { HostCapabilityAdapter } from "../runtime/HostInterop";
import { CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";

export class CosmHostObjectValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmHostObjectValue> = {
    properties: {
      kind: (self) => new CosmStringValue(self.adapter.kind),
    },
    methods: {
      inspect: () => new CosmFunctionValue("inspect", (args, selfValue) => {
        if (!(selfValue instanceof CosmHostObjectValue)) {
          throw new Error("Type error: inspect expects a HostObject receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: HostObject.inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(selfValue.inspectHost());
      }),
    },
  };

  constructor(
    public readonly target: unknown,
    private readonly adapter: HostCapabilityAdapter,
    classRef?: CosmClassValue,
  ) {
    super("HostObject", {}, classRef);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmHostObjectValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== "inspect") {
      return inherited;
    }
    return manifestMethod(this, name, CosmHostObjectValue.manifest);
  }

  hostKind(): string {
    return this.adapter.kind;
  }

  inspectHost(): string {
    return this.adapter.inspect(this.target);
  }

  hostKeys(): string[] {
    return this.adapter.keys(this.target);
  }

  hostHas(key: string): boolean {
    return this.adapter.has(this.target, key);
  }

  hostGet(key: string): CosmValue | undefined {
    return this.adapter.get(this.target, key);
  }

  hostSet(key: string, value: CosmValue): CosmValue {
    if (!this.adapter.set) {
      throw new Error(`Property error: host object '${this.adapter.kind}' is readonly`);
    }
    return this.adapter.set(this.target, key, value);
  }
}
