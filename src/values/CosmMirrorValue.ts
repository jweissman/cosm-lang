import { RuntimeValueManifest, manifestClassMethods, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmClass, CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmSymbolValue } from "./CosmSymbolValue";
import { ValueAdapter } from "../ValueAdapter";

export class CosmMirrorValue extends CosmObjectValue {
  private static classOfHandler?: (value: CosmValue) => CosmClass;
  private static lookupPropertyHandler?: (receiver: CosmValue, property: string) => CosmValue;

  static installRuntimeHooks(hooks: {
    classOf: (value: CosmValue) => CosmClass;
    lookupProperty: (receiver: CosmValue, property: string) => CosmValue;
  }): void {
    this.classOfHandler = hooks.classOf;
    this.lookupPropertyHandler = hooks.lookupProperty;
  }

  static readonly manifest: RuntimeValueManifest<CosmMirrorValue> = {
    properties: {
      targetClass: (self) => self.targetClass(),
    },
    methods: {
      inspect: () => new CosmFunctionValue("inspect", (args, selfValue) => {
        if (!(selfValue instanceof CosmMirrorValue)) {
          throw new Error("Type error: inspect expects a Mirror receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Mirror.inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(ValueAdapter.format(selfValue.target));
      }),
      methods: () => new CosmFunctionValue("methods", (args, selfValue) => {
        if (!(selfValue instanceof CosmMirrorValue)) {
          throw new Error("Type error: methods expects a Mirror receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Mirror.methods expects 0 arguments, got ${args.length}`);
        }
        if (selfValue.target.type === "class") {
          return new CosmNamespaceValue(selfValue.target.classMethods, selfValue.target.classRef);
        }
        const targetClass = selfValue.targetClass();
        return new CosmNamespaceValue(targetClass.methods, targetClass.classRef);
      }),
      get: () => new CosmFunctionValue("get", (args, selfValue) => {
        if (!(selfValue instanceof CosmMirrorValue)) {
          throw new Error("Type error: get expects a Mirror receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: Mirror.get expects 1 arguments, got ${args.length}`);
        }
        const [nameValue] = args;
        const name = selfValue.messageName(nameValue);
        if (!CosmMirrorValue.lookupPropertyHandler) {
          throw new Error("Mirror runtime error: property lookup handler is not installed");
        }
        return CosmMirrorValue.lookupPropertyHandler(selfValue.target, name);
      }),
      has: () => new CosmFunctionValue("has", (args, selfValue) => {
        if (!(selfValue instanceof CosmMirrorValue)) {
          throw new Error("Type error: has expects a Mirror receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: Mirror.has expects 1 arguments, got ${args.length}`);
        }
        const [nameValue] = args;
        const name = selfValue.messageName(nameValue);
        if (!CosmMirrorValue.lookupPropertyHandler) {
          throw new Error("Mirror runtime error: property lookup handler is not installed");
        }
        try {
          CosmMirrorValue.lookupPropertyHandler(selfValue.target, name);
          return new CosmBoolValue(true);
        } catch (error) {
          if (error instanceof Error && error.message.includes(`'${name}'`)) {
            return new CosmBoolValue(false);
          }
          throw error;
        }
      }),
    },
    classMethods: {
      reflect: () => new CosmFunctionValue("reflect", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Mirror.reflect expects a class receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: Mirror.reflect expects 1 arguments, got ${args.length}`);
        }
        return new CosmMirrorValue(args[0], selfValue);
      }),
    },
  };

  static bootClassMethods(): Record<string, CosmFunctionValue> {
    return manifestClassMethods(CosmMirrorValue.manifest);
  }

  constructor(
    public readonly target: CosmValue,
    classRef?: CosmClassValue,
  ) {
    super("Mirror", {}, classRef);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmMirrorValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmMirrorValue.manifest);
  }

  private targetClass(): CosmClass {
    if (!CosmMirrorValue.classOfHandler) {
      throw new Error("Mirror runtime error: class lookup handler is not installed");
    }
    return CosmMirrorValue.classOfHandler(this.target);
  }

  private messageName(value: CosmValue): string {
    if (value instanceof CosmStringValue) {
      return value.value;
    }
    if (value instanceof CosmSymbolValue) {
      return value.name;
    }
    throw new Error("Type error: Mirror expects a string or symbol name");
  }
}
