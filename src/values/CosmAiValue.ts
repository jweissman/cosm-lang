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

export class CosmAiValue extends CosmObjectValue {
  private static completeHandler?: (prompt: string, env?: CosmEnv) => CosmValue;
  private static castHandler?: (prompt: string, schema: CosmSchemaValue, env?: CosmEnv) => CosmValue;
  private static compareHandler?: (left: string, right: string, env?: CosmEnv) => boolean;

  static installRuntimeHooks(hooks: {
    complete?: (prompt: string, env?: CosmEnv) => CosmValue;
    cast?: (prompt: string, schema: CosmSchemaValue, env?: CosmEnv) => CosmValue;
    compare?: (left: string, right: string, env?: CosmEnv) => boolean;
  }): void {
    this.completeHandler = hooks.complete;
    this.castHandler = hooks.cast;
    this.compareHandler = hooks.compare;
  }

  static readonly manifest: RuntimeValueManifest<CosmAiValue> = {
    methods: {
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
}
