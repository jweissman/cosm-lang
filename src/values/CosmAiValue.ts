import { CosmEnv, CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { InvocationContext, normalizeInvocationContext } from "../runtime/InvocationContext";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmPromptValue } from "./CosmPromptValue";
import { CosmSchemaValue } from "./CosmSchemaValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmErrorValue } from "./CosmErrorValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmNihilValue } from "./CosmNihilValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { ValueAdapter } from "../ValueAdapter";
import { CosmDataModelValue } from "./CosmDataModelValue";

export class CosmAiValue extends CosmObjectValue {
  private static statusHandler?: () => CosmValue;
  private static healthHandler?: () => CosmValue;
  private static completeHandler?: (prompt: string, env?: CosmEnv) => CosmValue;
  private static castHandler?: (prompt: string, schema: CosmSchemaValue, env?: CosmEnv) => CosmValue;
  private static chatCastHandler?: (messages: Array<{ role: string; content: string }>, schema: CosmSchemaValue, env?: CosmEnv) => CosmValue;
  private static compareHandler?: (left: string, right: string, env?: CosmEnv) => boolean;
  private static streamHandler?: (prompt: string, onEvent: (event: { kind: string; text?: string; first?: boolean; index?: number }) => void, env?: CosmEnv) => CosmValue;
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], context: InvocationContext) => CosmValue;

  static installRuntimeHooks(hooks: {
    status?: () => CosmValue;
    health?: () => CosmValue;
    complete?: (prompt: string, env?: CosmEnv) => CosmValue;
    cast?: (prompt: string, schema: CosmSchemaValue, env?: CosmEnv) => CosmValue;
    chatCast?: (messages: Array<{ role: string; content: string }>, schema: CosmSchemaValue, env?: CosmEnv) => CosmValue;
    compare?: (left: string, right: string, env?: CosmEnv) => boolean;
    stream?: (prompt: string, onEvent: (event: { kind: string; text?: string; first?: boolean; index?: number }) => void, env?: CosmEnv) => CosmValue;
    invoke?: (callee: CosmValue, args: CosmValue[], context: InvocationContext) => CosmValue;
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
    if ("chatCast" in hooks) {
      this.chatCastHandler = hooks.chatCast;
    }
    if ("compare" in hooks) {
      this.compareHandler = hooks.compare;
    }
    if ("stream" in hooks) {
      this.streamHandler = hooks.stream;
    }
    if ("invoke" in hooks) {
      this.invokeHandler = hooks.invoke
        ? ((callee: CosmValue, args: CosmValue[], contextOrReceiver?: InvocationContext | CosmValue, env?: CosmEnv, currentBlock?: CosmValue) =>
          hooks.invoke?.(callee, args, normalizeInvocationContext(contextOrReceiver, env, currentBlock))) as typeof this.invokeHandler
        : undefined;
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
        if (!CosmAiValue.castHandler) {
          CosmErrorValue.raise(new CosmStringValue("AI backend is not configured for cast"), selfValue.errorClassRef);
        }
        const target = args[1];
        if (target instanceof CosmDataModelValue) {
          return target.validateAndReturn(CosmAiValue.castHandler(prompt, target.toSchema(), env));
        }
        if (!(target instanceof CosmSchemaValue)) {
          throw new Error("Type error: cosm.ai.cast expects a Schema or DataModel");
        }
        return CosmAiValue.castHandler(prompt, target, env);
      }),
      chat_cast: () => new CosmFunctionValue("chat_cast", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmAiValue)) {
          throw new Error("Type error: chat_cast expects an Ai receiver");
        }
        if (args.length !== 2) {
          throw new Error(`Arity error: cosm.ai.chat_cast expects 2 arguments, got ${args.length}`);
        }
        const messages = selfValue.expectMessages(args[0], "cosm.ai.chat_cast");
        const target = args[1];
        if (CosmAiValue.chatCastHandler) {
          if (target instanceof CosmDataModelValue) {
            return target.validateAndReturn(CosmAiValue.chatCastHandler(messages, target.toSchema(), env));
          }
          if (!(target instanceof CosmSchemaValue)) {
            throw new Error("Type error: cosm.ai.chat_cast expects a Schema or DataModel");
          }
          return CosmAiValue.chatCastHandler(messages, target, env);
        }
        if (!CosmAiValue.castHandler) {
          CosmErrorValue.raise(new CosmStringValue("AI backend is not configured for cast"), selfValue.errorClassRef);
        }
        const flattened = messages.map((entry) => `${entry.role}: ${entry.content}`).join("\n\n");
        if (target instanceof CosmDataModelValue) {
          return target.validateAndReturn(CosmAiValue.castHandler(flattened, target.toSchema(), env));
        }
        if (!(target instanceof CosmSchemaValue)) {
          throw new Error("Type error: cosm.ai.chat_cast expects a Schema or DataModel");
        }
        return CosmAiValue.castHandler(flattened, target, env);
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

  private streamEvent(event: { kind: string; text?: string; first?: boolean; index?: number }): CosmValue {
    return new CosmNamespaceValue({
      kind: new CosmStringValue(event.kind),
      text: event.text === undefined ? new CosmNihilValue() : new CosmStringValue(event.text),
      first: new CosmBoolValue(event.first === true),
      index: event.index === undefined ? new CosmNihilValue() : new CosmNumberValue(event.index),
    }, this.classRef);
  }

  private expectPrompt(value: CosmValue, context: string): string {
    const source = CosmPromptValue.sourceFrom(value);
    if (source === undefined) {
      throw new Error(`Type error: ${context} expects a Prompt or string`);
    }
    return source;
  }

  private expectMessages(value: CosmValue, context: string): Array<{ role: string; content: string }> {
    const candidate = ValueAdapter.cosmToJS(value);
    if (!Array.isArray(candidate)) {
      throw new Error(`Type error: ${context} expects an Array of message hashes`);
    }
    return candidate.map((entry) => {
      if (!entry || typeof entry !== "object") {
        throw new Error(`Type error: ${context} expects an Array of message hashes`);
      }
      const role = (entry as Record<string, unknown>).role;
      const content = (entry as Record<string, unknown>).content;
      if (typeof role !== "string" || typeof content !== "string") {
        throw new Error(`Type error: ${context} expects message hashes with string role and content`);
      }
      return { role, content };
    });
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
