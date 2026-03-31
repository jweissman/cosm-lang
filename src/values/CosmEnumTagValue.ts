import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";

export class CosmEnumTagValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmEnumTagValue> = {
    properties: {
      value: (self) => new CosmStringValue(self.literal),
    },
    methods: {
      eq: () => new CosmFunctionValue("eq", (args, selfValue) => {
        if (!(selfValue instanceof CosmEnumTagValue)) {
          throw new Error("Type error: eq expects an EnumTag receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: EnumTag.eq expects 1 arguments, got ${args.length}`);
        }
        const [right] = args;
        if (right instanceof CosmEnumTagValue) {
          return new CosmBoolValue(selfValue.literal === right.literal);
        }
        if (right instanceof CosmStringValue) {
          return new CosmBoolValue(selfValue.literal === right.value);
        }
        return new CosmBoolValue(false);
      }),
      plus: () => new CosmFunctionValue("plus", (args, selfValue) => {
        if (!(selfValue instanceof CosmEnumTagValue)) {
          throw new Error("Type error: plus expects an EnumTag receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: EnumTag.plus expects 1 arguments, got ${args.length}`);
        }
        return new CosmStringValue(selfValue.literal + args[0].toCosmString("concatenate"));
      }),
      inspect: () => new CosmFunctionValue("inspect", (args, selfValue) => {
        if (!(selfValue instanceof CosmEnumTagValue)) {
          throw new Error("Type error: inspect expects an EnumTag receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: EnumTag.inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(`:${selfValue.literal}`);
      }),
      to_s: () => new CosmFunctionValue("to_s", (args, selfValue) => {
        if (!(selfValue instanceof CosmEnumTagValue)) {
          throw new Error("Type error: to_s expects an EnumTag receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: EnumTag.to_s expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(selfValue.literal);
      }),
    },
  };

  constructor(
    public readonly literal: string,
    public readonly options: string[],
    classRef?: CosmClassValue,
  ) {
    super("EnumTag", {}, classRef);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmEnumTagValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    if (name.endsWith("?")) {
      const candidate = name.slice(0, -1);
      if (this.options.includes(candidate)) {
        return new CosmFunctionValue(name, (args, selfValue) => {
          if (!(selfValue instanceof CosmEnumTagValue)) {
            throw new Error(`Type error: ${name} expects an EnumTag receiver`);
          }
          if (args.length !== 0) {
            throw new Error(`Arity error: ${name} expects 0 arguments, got ${args.length}`);
          }
          return new CosmBoolValue(selfValue.literal === candidate);
        });
      }
    }
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmEnumTagValue.manifest);
  }

  override visibleNativeMethodNames(): string[] {
    return [
      ...super.visibleNativeMethodNames(),
      "plus",
      ...this.options.map((option) => `${option}?`),
    ];
  }

  override toCosmString(_context: 'concatenate' | 'interpolate'): string {
    return this.literal;
  }
}
