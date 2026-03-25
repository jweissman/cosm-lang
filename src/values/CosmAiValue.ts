import { CosmEnv, CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmPromptValue } from "./CosmPromptValue";
import { CosmSchemaValue } from "./CosmSchemaValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmErrorValue } from "./CosmErrorValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmNumberValue } from "./CosmNumberValue";

export class CosmAiValue extends CosmObjectValue {
  private static statusHandler?: () => CosmValue;
  private static healthHandler?: () => CosmValue;
  private static completeHandler?: (prompt: string, env?: CosmEnv) => CosmValue;
  private static castHandler?: (prompt: string, schema: CosmSchemaValue, env?: CosmEnv) => CosmValue;
  private static compareHandler?: (left: string, right: string, env?: CosmEnv) => boolean;
  private static streamHandler?: (prompt: string, onEvent: (event: { kind: string; text?: string; first?: boolean; index?: number; buffered?: boolean }) => void, env?: CosmEnv) => CosmValue;
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;

  static installRuntimeHooks(hooks: {
    status?: () => CosmValue;
    health?: () => CosmValue;
    complete?: (prompt: string, env?: CosmEnv) => CosmValue;
    cast?: (prompt: string, schema: CosmSchemaValue, env?: CosmEnv) => CosmValue;
    compare?: (left: string, right: string, env?: CosmEnv) => boolean;
    stream?: (prompt: string, onEvent: (event: { kind: string; text?: string; first?: boolean; index?: number; buffered?: boolean }) => void, env?: CosmEnv) => CosmValue;
    invoke?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  }): void {
    if ("status" in hooks) {
      this.statusHandler = hooks.status;
    }
    if ("health" in hooks) {
      this.healthHandler = hooks.health;
    }
    if ("complete" in hooks) {
      this.completeHandler = hooks.complete;
    }
    if ("cast" in hooks) {
      this.castHandler = hooks.cast;
    }
    if ("compare" in hooks) {
      this.compareHandler = hooks.compare;
    }
    if ("stream" in hooks) {
      this.streamHandler = hooks.stream;
    }
    if ("invoke" in hooks) {
      this.invokeHandler = hooks.invoke;
    }
  }

  static readonly manifest: RuntimeValueManifest<CosmAiValue> = {
    methods: {
      status: () => new CosmFunctionValue("status", (args, selfValue) => {
        if (!(selfValue instanceof CosmAiValue)) {
          throw new Error("Type error: status expects an Ai receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: cosm.ai.status expects 0 arguments, got ${args.length}`);
        }
        if (!CosmAiValue.statusHandler) {
          throw new Error("AI runtime error: status handler is not installed");
        }
        return CosmAiValue.statusHandler();
      }),
      config: () => new CosmFunctionValue("config", (args, selfValue) => {
        if (!(selfValue instanceof CosmAiValue)) {
          throw new Error("Type error: config expects an Ai receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: cosm.ai.config expects 0 arguments, got ${args.length}`);
        }
        if (!CosmAiValue.statusHandler) {
          throw new Error("AI runtime error: status handler is not installed");
        }
        return CosmAiValue.statusHandler();
      }),
      health: () => new CosmFunctionValue("health", (args, selfValue) => {
        if (!(selfValue instanceof CosmAiValue)) {
          throw new Error("Type error: health expects an Ai receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: cosm.ai.health expects 0 arguments, got ${args.length}`);
        }
        if (!CosmAiValue.healthHandler) {
          throw new Error("AI runtime error: health handler is not installed");
        }
        return CosmAiValue.healthHandler();
      }),
      complete: () => new CosmFunctionValue("complete", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmAiValue)) {
          throw new Error("Type error: complete expects an Ai receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: cosm.ai.complete expects 1 arguments, got ${args.length}`);
        }
        const prompt = selfValue.expectPrompt(args[0], "cosm.ai.complete");
        if (!CosmAiValue.completeHandler) {
          CosmErrorValue.raise(new CosmStringValue("AI backend is not configured for complete"), selfValue.errorClassRef);
        }
        return CosmAiValue.completeHandler(prompt, env);
      }),
      cast: () => new CosmFunctionValue("cast", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmAiValue)) {
          throw new Error("Type error: cast expects an Ai receiver");
        }
        if (args.length !== 2) {
          throw new Error(`Arity error: cosm.ai.cast expects 2 arguments, got ${args.length}`);
        }
        const prompt = selfValue.expectPrompt(args[0], "cosm.ai.cast");
        if (!(args[1] instanceof CosmSchemaValue)) {
          throw new Error("Type error: cosm.ai.cast expects a Schema");
        }
        if (!CosmAiValue.castHandler) {
          CosmErrorValue.raise(new CosmStringValue("AI backend is not configured for cast"), selfValue.errorClassRef);
        }
        return CosmAiValue.castHandler(prompt, args[1], env);
      }),
      compare: () => new CosmFunctionValue("compare", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmAiValue)) {
          throw new Error("Type error: compare expects an Ai receiver");
        }
        if (args.length !== 2) {
          throw new Error(`Arity error: cosm.ai.compare expects 2 arguments, got ${args.length}`);
        }
        const left = selfValue.expectPrompt(args[0], "cosm.ai.compare");
        const right = selfValue.expectPrompt(args[1], "cosm.ai.compare");
        return selfValue.compare(left, right, env);
      }),
      stream: () => new CosmFunctionValue("stream", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmAiValue)) {
          throw new Error("Type error: stream expects an Ai receiver");
        }
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: cosm.ai.stream expects 1 or 2 arguments, got ${args.length}`);
        }
        const prompt = selfValue.expectPrompt(args[0], "cosm.ai.stream");
        const callback = args[1] ?? CosmAiValue.currentBlock(env);
        if (!callback) {
          throw new Error("Block error: cosm.ai.stream expects a callback or trailing block");
        }
        if (!CosmAiValue.streamHandler) {
          CosmErrorValue.raise(new CosmStringValue("AI backend is not configured for stream"), selfValue.errorClassRef);
        }
        if (!CosmAiValue.invokeHandler) {
          throw new Error("AI runtime error: invoke handler is not installed");
        }
        return CosmAiValue.streamHandler(prompt, (event) => {
          CosmAiValue.invokeHandler!(
            callback,
            [selfValue.streamEvent(event)],
            undefined,
            env,
          );
        }, env);
      }),
    },
  };

  constructor(
    fields: Record<string, CosmValue>,
    classRef?: CosmClassValue,
    private readonly errorClassRef?: CosmClassValue,
  ) {
    super("Ai", fields, classRef);
  }

  static compareStrings(left: string, right: string, errorClassRef?: CosmClassValue, env?: CosmEnv): CosmBoolValue {
    if (!CosmAiValue.compareHandler) {
      CosmErrorValue.raise(new CosmStringValue("AI backend is not configured for semantic comparison"), errorClassRef);
    }
    return new CosmBoolValue(CosmAiValue.compareHandler(left, right, env));
  }

  compare(left: string, right: string, env?: CosmEnv): CosmValue {
    return CosmAiValue.compareStrings(left, right, this.errorClassRef, env);
  }

  private streamEvent(event: { kind: string; text?: string; first?: boolean; index?: number; buffered?: boolean }): CosmValue {
    return new CosmNamespaceValue({
      kind: new CosmStringValue(event.kind),
      text: event.text === undefined ? new CosmBoolValue(false) : new CosmStringValue(event.text),
      first: new CosmBoolValue(event.first === true),
      index: event.index === undefined ? new CosmBoolValue(false) : new CosmNumberValue(event.index),
      buffered: new CosmBoolValue(event.buffered === true),
    }, this.classRef);
  }

  private expectPrompt(value: CosmValue, context: string): string {
    const source = CosmPromptValue.sourceFrom(value);
    if (source === undefined) {
      throw new Error(`Type error: ${context} expects a Prompt or string`);
    }
    return source;
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmAiValue.manifest);
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
