import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmNumberValue } from "./CosmNumberValue";

export class CosmProcessValue extends CosmObjectValue {
  private static exitHandler?: (code?: number) => never;

  static installRuntimeHooks(hooks: {
    exit?: (code?: number) => never;
  }): void {
    this.exitHandler = hooks.exit;
  }

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
      argv: () => new CosmFunctionValue('argv', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: argv expects 0 arguments, got ${args.length}`);
        }
        return new CosmArrayValue(process.argv.map((arg) => new CosmStringValue(arg)));
      }),
      pid: () => new CosmFunctionValue('pid', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: pid expects 0 arguments, got ${args.length}`);
        }
        return new CosmNumberValue(process.pid);
      }),
      platform: () => new CosmFunctionValue('platform', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: platform expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(process.platform);
      }),
      arch: () => new CosmFunctionValue('arch', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: arch expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(process.arch);
      }),
      exit: () => new CosmFunctionValue('exit', (args) => {
        if (args.length > 1) {
          throw new Error(`Arity error: exit expects 0 or 1 arguments, got ${args.length}`);
        }
        const [code] = args;
        if (code && code.type !== 'number') {
          throw new Error('Type error: exit expects a numeric code');
        }
        const exitCode = code ? code.value : 0;
        if (!Number.isInteger(exitCode)) {
          throw new Error('Type error: exit expects an integer code');
        }
        const exitFn = CosmProcessValue.exitHandler ?? ((value?: number) => process.exit(value));
        return exitFn(exitCode);
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
