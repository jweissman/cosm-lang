import { CosmValue } from "../types";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmMethodValue extends CosmValueBase {
  readonly type = 'method';

  constructor(
    public readonly name: string,
    public readonly receiver: CosmValue,
    public readonly target: CosmFunctionValue
  ) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    if (name === 'name') {
      return new CosmStringValue(this.name);
    }
    if (name === 'receiver') {
      return this.receiver;
    }
    return undefined;
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    if (name !== 'call') {
      return undefined;
    }
    return new CosmFunctionValue('call', (args, selfValue) => {
      if (!(selfValue instanceof CosmMethodValue)) {
        throw new Error('Type error: call expects a method receiver');
      }
      if (args.length < 0) {
        throw new Error('Arity error: impossible');
      }
      if (selfValue.target.nativeCall) {
        return selfValue.target.nativeCall(args, selfValue.receiver);
      }
      throw new Error(`Invalid method target: ${selfValue.name}`);
    });
  }
}
