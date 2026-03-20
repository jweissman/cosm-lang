import { CosmValue } from "../types";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmStringValue extends CosmValueBase {
  readonly type = 'string';

  constructor(public readonly value: string) {
    super();
  }

  override plus(right: CosmValue): CosmValue {
    return new CosmStringValue(this.value + right.toCosmString('concatenate'));
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== 'eq') {
      return inherited;
    }
    if (name === 'plus') {
      return new CosmFunctionValue('plus', (args, selfValue) => {
        if (!(selfValue instanceof CosmStringValue)) {
          throw new Error('Type error: plus expects a string receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method plus expects 1 arguments, got ${args.length}`);
        }
        return selfValue.plus(args[0]);
      });
    }
    if (name === 'eq') {
      return new CosmFunctionValue('eq', (args, selfValue) => {
        if (!(selfValue instanceof CosmStringValue)) {
          throw new Error('Type error: eq expects a string receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method eq expects 1 arguments, got ${args.length}`);
        }
        return new CosmBoolValue(args[0] instanceof CosmStringValue && selfValue.value === args[0].value);
      });
    }
    return undefined;
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    if (name === 'length') {
      return new CosmNumberValue(this.value.length);
    }
    return undefined;
  }

  override toCosmString(): string {
    return this.value;
  }
}
