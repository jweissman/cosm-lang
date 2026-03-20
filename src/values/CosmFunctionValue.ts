import { CosmValue, CoreNode, CosmEnv } from "../types";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmFunctionValue extends CosmValueBase {
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue) => CosmValue;

  static installRuntimeHooks(hooks: {
    invoke: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue) => CosmValue;
  }): void {
    this.invokeHandler = hooks.invoke;
  }

  readonly type = 'function';

  constructor(
    public readonly name: string,
    public readonly nativeCall?: (args: CosmValue[], selfValue?: CosmValue) => CosmValue,
    public readonly params?: string[],
    public readonly body?: CoreNode,
    public readonly env?: CosmEnv
  ) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    if (name === 'name') {
      return new CosmStringValue(this.name);
    }
    return undefined;
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    if (name !== 'call') {
      return undefined;
    }
    return new CosmFunctionValue('call', (args, selfValue) => {
      if (!(selfValue instanceof CosmFunctionValue)) {
        throw new Error('Type error: call expects a function receiver');
      }
      if (!CosmFunctionValue.invokeHandler) {
        throw new Error('Function runtime error: invoke handler is not installed');
      }
      return CosmFunctionValue.invokeHandler(selfValue, args);
    });
  }
}
