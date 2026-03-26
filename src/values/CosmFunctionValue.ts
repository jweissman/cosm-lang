import { CosmValue, CoreNode, CosmEnv } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";
import { CosmClassValue } from "./CosmClassValue";
import { CosmModuleValue } from "./CosmModuleValue";


export class CosmFunctionValue extends CosmValueBase {
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;

  static installRuntimeHooks(hooks: {
    invoke: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  }): void {
    this.invokeHandler = hooks.invoke;
  }

  static readonly manifest: RuntimeValueManifest<CosmFunctionValue> = {
    properties: {
      name: (self) => new CosmStringValue(self.name),
    },
    methods: {
      call: () => new CosmFunctionValue('call', (args, selfValue, env) => {
        if (!(selfValue instanceof CosmFunctionValue)) {
          throw new Error('Type error: call expects a function receiver');
        }
        if (!CosmFunctionValue.invokeHandler) {
          throw new Error('Function runtime error: invoke handler is not installed');
        }
        return CosmFunctionValue.invokeHandler(selfValue, args, undefined, env);
      }),
    },
  };

  readonly type = 'function';

  constructor(
    public readonly name: string,
    public readonly nativeCall?: (args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue,
    public readonly params?: string[],
    public readonly defaults?: Record<string, CoreNode>,
    public readonly body?: CoreNode,
    public readonly env?: CosmEnv,
    public declaringOwner?: CosmClassValue | CosmModuleValue,
    public declaringOwnerToken?: string,
  ) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmFunctionValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmFunctionValue.manifest);
  }
}
