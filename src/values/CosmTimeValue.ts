import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";

export class CosmTimeValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmTimeValue> = {
    methods: {
      now: () => new CosmFunctionValue('now', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: now expects 0 arguments, got ${args.length}`);
        }
        return new CosmNumberValue(Date.now());
      }),
      isoNow: () => new CosmFunctionValue('isoNow', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: isoNow expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(new Date().toISOString());
      }),
      iso: () => new CosmFunctionValue('iso', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: iso expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        if (value.type !== 'number') {
          throw new Error('Type error: iso expects a numeric timestamp');
        }
        return new CosmStringValue(new Date(value.value).toISOString());
      }),
    },
  };

  constructor(fields: Record<string, import("../types").CosmValue>, classRef?: CosmClassValue) {
    super('Time', fields, classRef);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmTimeValue.manifest);
  }
}
