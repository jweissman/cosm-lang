import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { InvocationContext, normalizeInvocationContext } from "../runtime/InvocationContext";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmMethodValue extends CosmValueBase {
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], context: InvocationContext) => CosmValue;

  static installRuntimeHooks(hooks: {
    invoke: (callee: CosmValue, args: CosmValue[], context: InvocationContext) => CosmValue;
  }): void {
    this.invokeHandler = ((callee: CosmValue, args: CosmValue[], contextOrReceiver?: InvocationContext | CosmValue) =>
      hooks.invoke(callee, args, normalizeInvocationContext(contextOrReceiver))) as typeof this.invokeHandler;
  }

  static readonly manifest: RuntimeValueManifest<CosmMethodValue> = {
    properties: {
      name: (self) => new CosmStringValue(self.name),
      receiver: (self) => self.receiver,
      origin: (self) => new CosmStringValue(self.target.body ? "authored-cosm" : "native-ts"),
    },
    methods: {
      call: () => new CosmFunctionValue('call', (args, selfValue) => {
        if (!(selfValue instanceof CosmMethodValue)) {
          throw new Error('Type error: call expects a method receiver');
        }
        if (!CosmMethodValue.invokeHandler) {
          throw new Error('Method runtime error: invoke handler is not installed');
        }
        return CosmMethodValue.invokeHandler(selfValue, args, {});
      }),
    },
  };

  readonly type = 'method';

  constructor(
    public readonly name: string,
    public readonly receiver: CosmValue,
    public readonly target: CosmFunctionValue,
    public readonly ownerToken?: string,
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
