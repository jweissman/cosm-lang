import { RuntimeValueManifest, manifestClassMethods, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValue } from "../types";

export class CosmPromptValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmPromptValue> = {
    properties: {
      source: (self) => new CosmStringValue(self.sourceText),
    },
    classMethods: {
      text: () => new CosmFunctionValue("text", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Prompt.text expects a class receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: Prompt.text expects 1 arguments, got ${args.length}`);
        }
        const [source] = args;
        if (!(source instanceof CosmStringValue)) {
          throw new Error("Type error: Prompt.text expects a string");
        }
        return new CosmPromptValue(source.value, selfValue);
      }),
    },
  };

  static bootClassMethods(): Record<string, CosmFunctionValue> {
    return manifestClassMethods(CosmPromptValue.manifest);
  }

  constructor(
    public readonly sourceText: string,
    classRef?: CosmClassValue,
  ) {
    super("Prompt", {}, classRef);
  }

  static sourceFrom(value: CosmValue): string | undefined {
    if (value instanceof CosmStringValue) {
      return value.value;
    }
    if (value instanceof CosmPromptValue) {
      return value.sourceText;
    }
    return undefined;
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmPromptValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmPromptValue.manifest);
  }
}
