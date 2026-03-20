import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmBoolValue extends CosmValueBase {
  readonly type = 'bool';

  constructor(public readonly value: boolean) {
    super();
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== 'eq') {
      return inherited;
    }
    if (name === 'eq') {
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
    if (name === 'not') {
      return new CosmFunctionValue('not', (args, selfValue) => {
        if (!(selfValue instanceof CosmBoolValue)) {
          throw new Error('Type error: not expects a boolean receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method not expects 0 arguments, got ${args.length}`);
        }
        return new CosmBoolValue(!selfValue.value);
      });
    }
    if (name === 'and' || name === 'or') {
      return new CosmFunctionValue(name, (args, selfValue) => {
        if (!(selfValue instanceof CosmBoolValue)) {
          throw new Error(`Type error: ${name} expects a boolean receiver`);
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method ${name} expects 1 arguments, got ${args.length}`);
        }
        const [right] = args;
        if (!(right instanceof CosmBoolValue)) {
          throw new Error(`Type error: ${name} expects boolean operands`);
        }
        return new CosmBoolValue(name === 'and' ? selfValue.value && right.value : selfValue.value || right.value);
      });
    }
    return undefined;
  }

  override toCosmString(): string {
    return String(this.value);
  }
}
