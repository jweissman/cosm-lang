import { RuntimeValueManifest, manifestClassMethods, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmClass, CosmValue } from "../types";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmHashValue } from "./CosmHashValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmSymbolValue } from "./CosmSymbolValue";
import { ValueAdapter } from "../ValueAdapter";

type SupportedTarget = CosmHashValue | CosmObjectValue;

export class CosmHologramHandleValue extends CosmObjectValue {
  private static classOfHandler?: (value: CosmValue) => CosmClass;

  static installRuntimeHooks(hooks: {
    classOf: (value: CosmValue) => CosmClass;
  }): void {
    this.classOfHandler = hooks.classOf;
  }

  static readonly manifest: RuntimeValueManifest<CosmHologramHandleValue> = {
    properties: {
      targetClass: (self) => self.targetClass(),
      target_class: (self) => self.targetClass(),
    },
    methods: {
      inspect: () => new CosmFunctionValue("inspect", (args, selfValue) => {
        if (!(selfValue instanceof CosmHologramHandleValue)) {
          throw new Error("Type error: inspect expects a HologramHandle receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: HologramHandle.inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(`#<HologramHandle ${ValueAdapter.format(selfValue.target)}>`);
      }),
      has: () => new CosmFunctionValue("has", (args, selfValue) => {
        if (!(selfValue instanceof CosmHologramHandleValue)) {
          throw new Error("Type error: has expects a HologramHandle receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: HologramHandle.has expects 1 arguments, got ${args.length}`);
        }
        return new CosmBoolValue(selfValue.hasEntry(selfValue.keyName(args[0])));
      }),
      get: () => new CosmFunctionValue("get", (args, selfValue) => {
        if (!(selfValue instanceof CosmHologramHandleValue)) {
          throw new Error("Type error: get expects a HologramHandle receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: HologramHandle.get expects 1 arguments, got ${args.length}`);
        }
        const key = selfValue.keyName(args[0]);
        return selfValue.readEntry(key);
      }),
      set: () => new CosmFunctionValue("set", (args, selfValue) => {
        if (!(selfValue instanceof CosmHologramHandleValue)) {
          throw new Error("Type error: set expects a HologramHandle receiver");
        }
        if (args.length !== 2) {
          throw new Error(`Arity error: HologramHandle.set expects 2 arguments, got ${args.length}`);
        }
        const [nameValue, nextValue] = args;
        const key = selfValue.keyName(nameValue);
        selfValue.writeEntry(key, nextValue);
        return nextValue;
      }),
      keys: () => new CosmFunctionValue("keys", (args, selfValue) => {
        if (!(selfValue instanceof CosmHologramHandleValue)) {
          throw new Error("Type error: keys expects a HologramHandle receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: HologramHandle.keys expects 0 arguments, got ${args.length}`);
        }
        return new CosmArrayValue(selfValue.entryKeys().map((key) => new CosmSymbolValue(key)));
      }),
    },
    classMethods: {
      wrap: () => new CosmFunctionValue("wrap", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: HologramHandle.wrap expects a class receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: HologramHandle.wrap expects 1 arguments, got ${args.length}`);
        }
        return CosmHologramHandleValue.wrap(args[0], selfValue);
      }),
      status: () => new CosmFunctionValue("status", (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: HologramHandle.status expects 0 arguments, got ${args.length}`);
        }
        return new CosmNamespaceValue({
          ready: new CosmBoolValue(true),
          mode: new CosmStringValue("narrow-writable-boundary"),
          intended_role: new CosmStringValue("js-interop-capability-wrapper"),
          translation: new CosmBoolValue(true),
          observes_runtime_values: new CosmBoolValue(true),
          observes_host_backed_values: new CosmBoolValue(true),
          writable: new CosmBoolValue(true),
          writable_targets: new CosmArrayValue([
            new CosmStringValue("Hash"),
            new CosmStringValue("Object"),
            new CosmStringValue("Namespace"),
            new CosmStringValue("Module"),
            new CosmStringValue("Process"),
          ]),
          readable_surface: new CosmArrayValue([
            new CosmStringValue("targetClass"),
            new CosmStringValue("inspect"),
            new CosmStringValue("keys"),
            new CosmStringValue("has"),
            new CosmStringValue("get"),
            new CosmStringValue("set"),
          ]),
          rejects: new CosmArrayValue([
            new CosmStringValue("Number"),
            new CosmStringValue("Boolean"),
            new CosmStringValue("String"),
            new CosmStringValue("Array"),
            new CosmStringValue("general-js-bridge"),
          ]),
        });
      }),
    },
  };

  static bootClassMethods(): Record<string, CosmFunctionValue> {
    return manifestClassMethods(CosmHologramHandleValue.manifest);
  }

  static wrap(value: CosmValue, classRef?: CosmClassValue): CosmHologramHandleValue {
    if (!(value instanceof CosmHashValue) && !(value instanceof CosmObjectValue)) {
      throw new Error(`Type error: Hologram.wrap currently supports Hash and object-like values, got ${value.type}`);
    }
    return new CosmHologramHandleValue(value, classRef);
  }

  constructor(
    public readonly target: SupportedTarget,
    classRef?: CosmClassValue,
  ) {
    super("HologramHandle", {}, classRef);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmHologramHandleValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== "inspect") {
      return inherited;
    }
    return manifestMethod(this, name, CosmHologramHandleValue.manifest);
  }

  private targetClass(): CosmClass {
    if (!CosmHologramHandleValue.classOfHandler) {
      throw new Error("Hologram runtime error: class lookup handler is not installed");
    }
    return CosmHologramHandleValue.classOfHandler(this.target);
  }

  private keyName(value: CosmValue): string {
    if (value instanceof CosmStringValue) {
      return value.value;
    }
    if (value instanceof CosmSymbolValue) {
      return value.name;
    }
    throw new Error("Type error: Hologram expects a string or symbol key");
  }

  private entryKeys(): string[] {
    return this.target instanceof CosmHashValue
      ? Object.keys(this.target.entries)
      : Object.keys(this.target.fields);
  }

  private hasEntry(key: string): boolean {
    if (this.target instanceof CosmHashValue) {
      return Object.hasOwn(this.target.entries, key);
    }
    return this.readObjectEntry(key) !== undefined;
  }

  private readEntry(key: string): CosmValue {
    const value = this.target instanceof CosmHashValue
      ? this.target.entries[key]
      : this.readObjectEntry(key);
    if (value === undefined) {
      throw new Error(`Property error: hologram target has no entry '${key}'`);
    }
    return value;
  }

  private writeEntry(key: string, value: CosmValue): void {
    if (this.target instanceof CosmHashValue) {
      this.target.entries[key] = value;
      return;
    }
    this.target.fields[key] = value;
  }

  private readObjectEntry(key: string): CosmValue | undefined {
    if (Object.hasOwn(this.target.fields, key)) {
      return this.target.fields[key];
    }
    const nativeProperty = this.target.nativeProperty(key);
    if (nativeProperty !== undefined) {
      return nativeProperty;
    }
    return this.target.nativeMethod(key);
  }
}
