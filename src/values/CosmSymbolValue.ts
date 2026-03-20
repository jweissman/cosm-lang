import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestClassMethods, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmSymbolValue extends CosmValueBase {
  private static internHandler?: (name: string) => CosmValue;

  static installRuntimeHooks(hooks: {
    intern: (name: string) => CosmValue;
  }): void {
    this.internHandler = hooks.intern;
  }

  static readonly manifest: RuntimeValueManifest<CosmSymbolValue> = {
    properties: {
      name: (self) => new CosmStringValue(self.name),
    },
    methods: {
      eq: () => new CosmFunctionValue('eq', (args, selfValue) => {
        if (!(selfValue instanceof CosmSymbolValue)) {
          throw new Error('Type error: eq expects a symbol receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method eq expects 1 arguments, got ${args.length}`);
        }
        return new CosmBoolValue(args[0] instanceof CosmSymbolValue && selfValue.name === args[0].name);
      }),
    },
    classMethods: {
      intern: () => new CosmFunctionValue('intern', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: Symbol.intern expects 1 arguments, got ${args.length}`);
        }
        if (!CosmSymbolValue.internHandler) {
          throw new Error('Symbol runtime error: intern handler is not installed');
        }
        const [name] = args;
        if (!(name instanceof CosmStringValue)) {
          throw new Error('Type error: Symbol.intern expects a string argument');
        }
        return CosmSymbolValue.internHandler(name.value);
      }),
    },
  };

  readonly type = 'symbol';

  constructor(public readonly name: string) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmSymbolValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== 'eq') {
      return inherited;
    }
    return manifestMethod(this, name, CosmSymbolValue.manifest);
  }

  static bootClassMethods(): Record<string, CosmFunctionValue> {
    return manifestClassMethods(CosmSymbolValue.manifest);
  }

  override toCosmString(): string {
    return `:${this.name}`;
  }
}
