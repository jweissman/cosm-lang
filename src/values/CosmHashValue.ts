import { CosmEnv, CosmValue } from "../types";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmHashValue extends CosmValueBase {
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;

  static installRuntimeHooks(hooks: {
    invoke?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  }): void {
    this.invokeHandler = hooks.invoke;
  }

  readonly type = 'hash';

  constructor(public readonly entries: Record<string, CosmValue>) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    if (name === 'length') {
      return new CosmNumberValue(Object.keys(this.entries).length);
    }
    return this.entries[name];
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    if (name === "each") {
      return new CosmFunctionValue("each", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmHashValue)) {
          throw new Error("Type error: each expects a Hash receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: each expects 0 or 1 arguments, got ${args.length}`);
        }
        const callback = args[0] ?? CosmHashValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: each expects a callback or trailing block");
        }
        if (!CosmHashValue.invokeHandler) {
          throw new Error("Hash runtime error: invoke handler is not installed");
        }
        for (const [key, value] of Object.entries(selfValue.entries)) {
          CosmHashValue.invokeHandler(callback, [new CosmStringValue(key), value], undefined, env);
        }
        return selfValue;
      });
    }
    if (name === "map") {
      return new CosmFunctionValue("map", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmHashValue)) {
          throw new Error("Type error: map expects a Hash receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: map expects 0 or 1 arguments, got ${args.length}`);
        }
        const callback = args[0] ?? CosmHashValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: map expects a callback or trailing block");
        }
        if (!CosmHashValue.invokeHandler) {
          throw new Error("Hash runtime error: invoke handler is not installed");
        }
        return new CosmArrayValue(
          Object.entries(selfValue.entries).map(([key, value]) =>
            CosmHashValue.invokeHandler!(callback, [new CosmStringValue(key), value], undefined, env),
          ),
        );
      });
    }
    if (name === "select") {
      return new CosmFunctionValue("select", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmHashValue)) {
          throw new Error("Type error: select expects a Hash receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: select expects 0 or 1 arguments, got ${args.length}`);
        }
        const callback = args[0] ?? CosmHashValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: select expects a callback or trailing block");
        }
        if (!CosmHashValue.invokeHandler) {
          throw new Error("Hash runtime error: invoke handler is not installed");
        }
        const entries = Object.fromEntries(
          Object.entries(selfValue.entries).filter(([key, value]) => {
            const result = CosmHashValue.invokeHandler!(callback, [new CosmStringValue(key), value], undefined, env);
            if (!(result instanceof CosmBoolValue)) {
              throw new Error("Type error: select expects the callback to return a boolean");
            }
            return result.value;
          }),
        );
        return new CosmHashValue(entries);
      });
    }
    return undefined;
  }

  override visibleNativeMethodNames(): string[] {
    return [...super.visibleNativeMethodNames(), "each", "map", "select"];
  }

  private static currentBlock(env?: CosmEnv): CosmValue | undefined {
    for (let scope = env; scope; scope = scope.parent) {
      if (scope.currentBlock) {
        return scope.currentBlock;
      }
    }
    return undefined;
  }
}
