import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmSymbolValue } from "./CosmSymbolValue";


export class CosmNamespaceValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmNamespaceValue> = {
    properties: {
      length: (self) => new CosmNumberValue(Object.keys(self.fields).length),
    },
    methods: {
      keys: () => new CosmFunctionValue('keys', (_args, selfValue) => {
        if (!(selfValue instanceof CosmNamespaceValue)) {
          throw new Error('Type error: keys expects a namespace receiver');
        }
        return new CosmArrayValue(Object.keys(selfValue.fields).map((key) => new CosmSymbolValue(key)));
      }),
      has: () => new CosmFunctionValue('has', (args, selfValue) => {
        if (!(selfValue instanceof CosmNamespaceValue)) {
          throw new Error('Type error: has expects a namespace receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method has expects 1 arguments, got ${args.length}`);
        }
        const [nameValue] = args;
        if (nameValue instanceof CosmSymbolValue) {
          return new CosmBoolValue(Object.hasOwn(selfValue.fields, nameValue.name));
        }
        if (nameValue instanceof CosmStringValue) {
          return new CosmBoolValue(Object.hasOwn(selfValue.fields, nameValue.value));
        }
        throw new Error('Type error: has expects a string or symbol argument');
      }),
      values: () => new CosmFunctionValue('values', (_args, selfValue) => {
        if (!(selfValue instanceof CosmNamespaceValue)) {
          throw new Error('Type error: values expects a namespace receiver');
        }
        return new CosmArrayValue(Object.values(selfValue.fields));
      }),
      get: () => new CosmFunctionValue('get', (args, selfValue) => {
        if (!(selfValue instanceof CosmNamespaceValue)) {
          throw new Error('Type error: get expects a namespace receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method get expects 1 arguments, got ${args.length}`);
        }
        const [nameValue] = args;
        const key = nameValue instanceof CosmSymbolValue
          ? nameValue.name
          : nameValue instanceof CosmStringValue
            ? nameValue.value
            : undefined;
        if (!key) {
          throw new Error('Type error: get expects a string or symbol argument');
        }
        const value = selfValue.fields[key];
        if (value === undefined) {
          throw new Error(`Property error: namespace has no entry '${key}'`);
        }
        return value;
      }),
    },
  };

  constructor(fields: Record<string, CosmValue>, classRef?: CosmClassValue) {
    super('Namespace', fields, classRef);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmNamespaceValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmNamespaceValue.manifest);
  }
}
