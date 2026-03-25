import { CosmEnv, CosmValue } from "../types";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmArrayValue extends CosmValueBase {
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;

  static installRuntimeHooks(hooks: {
    invoke?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  }): void {
    this.invokeHandler = hooks.invoke;
  }

  readonly type = 'array';

  constructor(public readonly items: CosmValue[]) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    if (name === 'length') {
      return new CosmNumberValue(this.items.length);
    }
    return undefined;
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    if (name === "each") {
      return new CosmFunctionValue("each", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: each expects an Array receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: each expects 0 or 1 arguments, got ${args.length}`);
        }
        const callback = args[0] ?? CosmArrayValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: each expects a callback or trailing block");
        }
        if (!CosmArrayValue.invokeHandler) {
          throw new Error("Array runtime error: invoke handler is not installed");
        }
        for (const item of selfValue.items) {
          CosmArrayValue.invokeHandler(callback, [item], undefined, env);
        }
        return selfValue;
      });
    }
    if (name === "append") {
      return new CosmFunctionValue("append", (args, selfValue) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: append expects an Array receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: append expects 1 arguments, got ${args.length}`);
        }
        return new CosmArrayValue([...selfValue.items, args[0]]);
      });
    }
    if (name === "first") {
      return new CosmFunctionValue("first", (args, selfValue) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: first expects an Array receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: first expects 0 arguments, got ${args.length}`);
        }
        return selfValue.items[0] ?? new CosmBoolValue(false);
      });
    }
    if (name === "map") {
      return new CosmFunctionValue("map", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: map expects an Array receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: map expects 0 or 1 arguments, got ${args.length}`);
        }
        const callback = args[0] ?? CosmArrayValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: map expects a callback or trailing block");
        }
        if (!CosmArrayValue.invokeHandler) {
          throw new Error("Array runtime error: invoke handler is not installed");
        }
        return new CosmArrayValue(selfValue.items.map((item) => CosmArrayValue.invokeHandler!(callback, [item], undefined, env)));
      });
    }
    if (name === "select") {
      return new CosmFunctionValue("select", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: select expects an Array receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: select expects 0 or 1 arguments, got ${args.length}`);
        }
        const callback = args[0] ?? CosmArrayValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: select expects a callback or trailing block");
        }
        if (!CosmArrayValue.invokeHandler) {
          throw new Error("Array runtime error: invoke handler is not installed");
        }
        const items = selfValue.items.filter((item) => {
          const result = CosmArrayValue.invokeHandler!(callback, [item], undefined, env);
          if (!(result instanceof CosmBoolValue)) {
            throw new Error("Type error: select expects the callback to return a boolean");
          }
          return result.value;
        });
        return new CosmArrayValue(items);
      });
    }
    if (name === "reject") {
      return new CosmFunctionValue("reject", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: reject expects an Array receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: reject expects 0 or 1 arguments, got ${args.length}`);
        }
        const callback = args[0] ?? CosmArrayValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: reject expects a callback or trailing block");
        }
        if (!CosmArrayValue.invokeHandler) {
          throw new Error("Array runtime error: invoke handler is not installed");
        }
        const items = selfValue.items.filter((item) => {
          const result = CosmArrayValue.invokeHandler!(callback, [item], undefined, env);
          if (!(result instanceof CosmBoolValue)) {
            throw new Error("Type error: reject expects the callback to return a boolean");
          }
          return !result.value;
        });
        return new CosmArrayValue(items);
      });
    }
    if (name === "find") {
      return new CosmFunctionValue("find", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: find expects an Array receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: find expects 0 or 1 arguments, got ${args.length}`);
        }
        const callback = args[0] ?? CosmArrayValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: find expects a callback or trailing block");
        }
        if (!CosmArrayValue.invokeHandler) {
          throw new Error("Array runtime error: invoke handler is not installed");
        }
        for (const item of selfValue.items) {
          const result = CosmArrayValue.invokeHandler!(callback, [item], undefined, env);
          if (!(result instanceof CosmBoolValue)) {
            throw new Error("Type error: find expects the callback to return a boolean");
          }
          if (result.value) {
            return item;
          }
        }
        return new CosmBoolValue(false);
      });
    }
    if (name === "join") {
      return new CosmFunctionValue("join", (args, selfValue) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: join expects an Array receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: join expects 0 or 1 arguments, got ${args.length}`);
        }
        const separator = args[0];
        if (separator && separator.type !== "string") {
          throw new Error("Type error: join expects a string separator");
        }
        return new CosmStringValue(selfValue.items.map((item) => item.toCosmString()).join(separator?.value ?? ""));
      });
    }
    if (name === "take") {
      return new CosmFunctionValue("take", (args, selfValue) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: take expects an Array receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: take expects 1 arguments, got ${args.length}`);
        }
        const [count] = args;
        if (!(count instanceof CosmNumberValue)) {
          throw new Error("Type error: take expects a numeric count");
        }
        return new CosmArrayValue(selfValue.items.slice(0, Math.max(0, Math.trunc(count.value))));
      });
    }
    if (name === "reduce") {
      return new CosmFunctionValue("reduce", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmArrayValue)) {
          throw new Error("Type error: reduce expects an Array receiver");
        }
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: reduce expects 1 or 2 arguments, got ${args.length}`);
        }
        const callback = args[1] ?? CosmArrayValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: reduce expects a callback or trailing block");
        }
        if (!CosmArrayValue.invokeHandler) {
          throw new Error("Array runtime error: invoke handler is not installed");
        }
        let accumulator = args[0];
        for (const item of selfValue.items) {
          accumulator = CosmArrayValue.invokeHandler!(callback, [accumulator, item], undefined, env);
        }
        return accumulator;
      });
    }
    return undefined;
  }

  override visibleNativeMethodNames(): string[] {
    return [...super.visibleNativeMethodNames(), "append", "each", "find", "first", "join", "map", "reduce", "reject", "select", "take"];
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
