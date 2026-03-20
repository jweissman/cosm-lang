import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmMethodValue extends CosmValueBase {
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue) => CosmValue;

  static installRuntimeHooks(hooks: {
    invoke: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue) => CosmValue;
  }): void {
    this.invokeHandler = hooks.invoke;
  }

  static readonly manifest: RuntimeValueManifest<CosmMethodValue> = {
    properties: {
      name: (self) => new CosmStringValue(self.name),
      receiver: (self) => self.receiver,
    },
    methods: {
      call: () => new CosmFunctionValue('call', (args, selfValue) => {
        if (!(selfValue instanceof CosmMethodValue)) {
          throw new Error('Type error: call expects a method receiver');
        }
        if (!CosmMethodValue.invokeHandler) {
          throw new Error('Method runtime error: invoke handler is not installed');
        }
        return CosmMethodValue.invokeHandler(selfValue, args);
      }),
    },
  };

  readonly type = 'method';

  constructor(
    public readonly name: string,
    public readonly receiver: CosmValue,
    public readonly target: CosmFunctionValue
  ) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmMethodValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmMethodValue.manifest);
  }
}
