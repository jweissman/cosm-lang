import { CosmValue } from "../types";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmSymbolValue extends CosmValueBase {
  readonly type = 'symbol';

  constructor(public readonly name: string) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    if (name === 'name') {
      return new CosmStringValue(this.name);
    }
    return undefined;
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    if (name !== 'eq') {
      return undefined;
    }
    return new CosmFunctionValue('eq', (args, selfValue) => {
      if (!(selfValue instanceof CosmSymbolValue)) {
        throw new Error('Type error: eq expects a symbol receiver');
      }
      if (args.length !== 1) {
        throw new Error(`Arity error: method eq expects 1 arguments, got ${args.length}`);
      }
      return new CosmBoolValue(args[0] instanceof CosmSymbolValue && selfValue.name === args[0].name);
    });
  }

  override toCosmString(): string {
    return `:${this.name}`;
  }
}
