import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmBoolValue } from "./CosmBoolValue";

export class CosmProcessValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmProcessValue> = {
    methods: {
      cwd: () => new CosmFunctionValue('cwd', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: cwd expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(process.cwd());
      }),
      env: () => new CosmFunctionValue('env', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: env expects 1 arguments, got ${args.length}`);
        }
        const [name] = args;
        if (!(name instanceof CosmStringValue)) {
          throw new Error('Type error: env expects a string name');
        }
        const value = process.env[name.value];
        return value === undefined ? new CosmBoolValue(false) : new CosmStringValue(value);
      }),
    },
  };

  constructor(fields: Record<string, import("../types").CosmValue>, classRef?: CosmClassValue) {
    super('Process', fields, classRef);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmProcessValue.manifest);
  }
}
