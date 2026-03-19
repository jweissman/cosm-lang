import { CosmValue, CosmFunctionValue } from "./types";


export abstract class CosmValueBase {
  abstract readonly type: string;

  plus(_right: CosmValue): CosmValue {
    throw new Error('Type error: add expects numeric operands or string concatenation');
  }

  nativeProperty(_name: string): CosmValue | undefined {
    return undefined;
  }

  nativeMethod(_name: string): CosmFunctionValue | undefined {
    return undefined;
  }

  toCosmString(context: 'concatenate' | 'interpolate'): string {
    if (context === 'interpolate') {
      throw new Error(`Type error: cannot interpolate value of type ${this.type} into a string`);
    }
    throw new Error(`Type error: cannot concatenate value of type ${this.type} into a string`);
  }
}
