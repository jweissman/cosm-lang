import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmBoolValue extends CosmValueBase {
  readonly type = 'bool';

  constructor(public readonly value: boolean) {
    super();
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    if (name !== 'eq') {
      return undefined;
    }
    return new CosmFunctionValue('eq', (args, selfValue) => {
      if (!(selfValue instanceof CosmBoolValue)) {
        throw new Error('Type error: eq expects a boolean receiver');
      }
      if (args.length !== 1) {
        throw new Error(`Arity error: method eq expects 1 arguments, got ${args.length}`);
      }
      return new CosmBoolValue(args[0] instanceof CosmBoolValue && selfValue.value === args[0].value);
    });
  }

  override toCosmString(): string {
    return String(this.value);
  }
}
