import { CosmValue } from "../types";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmValueBase } from "./CosmValueBase";
import { CosmAiValue } from "./CosmAiValue";
import { CosmArrayValue } from "./CosmArrayValue";


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
    if (inherited && name !== 'eq' && name !== 'semanticEq') {
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
    if (name === 'to_i') {
      return new CosmFunctionValue('to_i', (args, selfValue) => {
        if (!(selfValue instanceof CosmStringValue)) {
          throw new Error('Type error: to_i expects a string receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method to_i expects 0 arguments, got ${args.length}`);
        }
        const trimmed = selfValue.value.trim();
        if (!/^[+-]?\d+$/u.test(trimmed)) {
          throw new Error(`Conversion error: cannot convert ${JSON.stringify(selfValue.value)} to Integer`);
        }
        return new CosmNumberValue(Number.parseInt(trimmed, 10));
      });
    }
    if (name === 'to_f') {
      return new CosmFunctionValue('to_f', (args, selfValue) => {
        if (!(selfValue instanceof CosmStringValue)) {
          throw new Error('Type error: to_f expects a string receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method to_f expects 0 arguments, got ${args.length}`);
        }
        const trimmed = selfValue.value.trim();
        if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/u.test(trimmed)) {
          throw new Error(`Conversion error: cannot convert ${JSON.stringify(selfValue.value)} to Float`);
        }
        return new CosmNumberValue(Number.parseFloat(trimmed));
      });
    }
    if (name === 'semanticEq') {
      return new CosmFunctionValue('semanticEq', (args, selfValue, env) => {
        if (!(selfValue instanceof CosmStringValue)) {
          throw new Error('Type error: semanticEq expects a string receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method semanticEq expects 1 arguments, got ${args.length}`);
        }
        if (!(args[0] instanceof CosmStringValue)) {
          throw new Error('Type error: semanticEq expects a string argument');
        }
        return CosmAiValue.compareStrings(selfValue.value, args[0].value, undefined, env);
      });
    }
    if (name === 'trim') {
      return new CosmFunctionValue('trim', (args, selfValue) => {
        if (!(selfValue instanceof CosmStringValue)) {
          throw new Error('Type error: trim expects a string receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method trim expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(selfValue.value.trim());
      });
    }
    if (name === 'split') {
      return new CosmFunctionValue('split', (args, selfValue) => {
        if (!(selfValue instanceof CosmStringValue)) {
          throw new Error('Type error: split expects a string receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method split expects 1 arguments, got ${args.length}`);
        }
        if (!(args[0] instanceof CosmStringValue)) {
          throw new Error('Type error: split expects a string separator');
        }
        return new CosmArrayValue(selfValue.value.split(args[0].value).map((entry) => new CosmStringValue(entry)));
      });
    }
    if (name === 'startsWith') {
      return new CosmFunctionValue('startsWith', (args, selfValue) => {
        if (!(selfValue instanceof CosmStringValue)) {
          throw new Error('Type error: startsWith expects a string receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method startsWith expects 1 arguments, got ${args.length}`);
        }
        if (!(args[0] instanceof CosmStringValue)) {
          throw new Error('Type error: startsWith expects a string prefix');
        }
        return new CosmBoolValue(selfValue.value.startsWith(args[0].value));
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

  override visibleNativeMethodNames(): string[] {
    return ['plus', 'semanticEq', 'split', 'startsWith', 'to_i', 'to_f', 'trim'];
  }

  override toCosmString(): string {
    return this.value;
  }
}
