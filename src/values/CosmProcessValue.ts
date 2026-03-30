import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmHashValue } from "./CosmHashValue";

// Process remains TS-backed because it is a direct host/process boundary.
// Its reflective/object surface may be taught in Cosm, but the primitive
// capability ownership stays with the host runtime.
export class CosmProcessValue extends CosmObjectValue {
  private static exitHandler?: (code?: number) => never;

  static installRuntimeHooks(hooks: {
    exit?: (code?: number) => never;
  }): void {
    this.exitHandler = hooks.exit;
  }

  private static stripQuotes(value: string): string {
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return value.slice(1, -1);
      }
    }
    return value;
  }

  private static loadEnvFile(path: string, overwrite = false): CosmHashValue {
    const resolvedPath = resolve(process.cwd(), path);
    if (!existsSync(resolvedPath)) {
      return new CosmHashValue({
        ok: new CosmBoolValue(false),
        path: new CosmStringValue(path),
        loaded: new CosmBoolValue(false),
        count: new CosmNumberValue(0),
        overwritten: new CosmNumberValue(0),
      });
    }

    const source = readFileSync(resolvedPath, "utf8");
    let loaded = 0;
    let overwrittenCount = 0;

    for (const rawLine of source.split(/\r?\n/u)) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
      const separatorIndex = normalized.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = normalized.slice(0, separatorIndex).trim();
      if (!key) {
        continue;
      }

      if (!overwrite && process.env[key] !== undefined) {
        continue;
      }

      if (overwrite && process.env[key] !== undefined) {
        overwrittenCount += 1;
      }

      const rawValue = normalized.slice(separatorIndex + 1).trim();
      process.env[key] = this.stripQuotes(rawValue);
      loaded += 1;
    }

    return new CosmHashValue({
      ok: new CosmBoolValue(true),
      path: new CosmStringValue(path),
      loaded: new CosmBoolValue(true),
      count: new CosmNumberValue(loaded),
      overwritten: new CosmNumberValue(overwrittenCount),
    });
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
      load_env_file: () => new CosmFunctionValue('load_env_file', (args) => {
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: load_env_file expects 1 or 2 arguments, got ${args.length}`);
        }
        const [pathValue, overwriteValue] = args;
        if (!(pathValue instanceof CosmStringValue)) {
          throw new Error("Type error: load_env_file expects a string path");
        }
        if (overwriteValue && !(overwriteValue instanceof CosmBoolValue)) {
          throw new Error("Type error: load_env_file expects an optional boolean overwrite flag");
        }
        return this.loadEnvFile(pathValue.value, overwriteValue?.value ?? false);
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
