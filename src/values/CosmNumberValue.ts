import { CosmValue } from "../types";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmValueBase } from "./CosmValueBase";

export class CosmNumberValue extends CosmValueBase {
  readonly type = 'number';

  constructor(public readonly value: number) {
    super();
  }

  override plus(right: CosmValue): CosmValue {
    if (right instanceof CosmNumberValue) {
      return new CosmNumberValue(this.value + right.value);
    }
    throw new Error('Type error: add expects numeric operands or string concatenation');
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== 'eq') {
      return inherited;
    }
    if (name === 'plus') {
      return new CosmFunctionValue('plus', (args, selfValue) => {
        if (!(selfValue instanceof CosmNumberValue)) {
          throw new Error('Type error: plus expects a numeric receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method plus expects 1 arguments, got ${args.length}`);
        }
        return selfValue.plus(args[0]);
      });
    }
    if (name === 'pos' || name === 'neg') {
      return new CosmFunctionValue(name, (args, selfValue) => {
        if (!(selfValue instanceof CosmNumberValue)) {
          throw new Error(`Type error: ${name} expects a numeric receiver`);
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method ${name} expects 0 arguments, got ${args.length}`);
        }
        return new CosmNumberValue(name === 'pos' ? selfValue.value : -selfValue.value);
      });
    }
    if (name === 'subtract' || name === 'multiply' || name === 'divide' || name === 'pow') {
      return new CosmFunctionValue(name, (args, selfValue) => {
        if (!(selfValue instanceof CosmNumberValue)) {
          throw new Error(`Type error: ${name} expects a numeric receiver`);
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method ${name} expects 1 arguments, got ${args.length}`);
        }
        const [right] = args;
        if (!(right instanceof CosmNumberValue)) {
          throw new Error(`Type error: ${name} expects numeric operands`);
        }
        switch (name) {
          case 'subtract':
            return new CosmNumberValue(selfValue.value - right.value);
          case 'multiply':
            return new CosmNumberValue(selfValue.value * right.value);
          case 'divide':
            return new CosmNumberValue(selfValue.value / right.value);
          case 'pow':
            return new CosmNumberValue(selfValue.value ** right.value);
        }
      });
    }
    if (name === 'eq' || name === 'lt' || name === 'lte' || name === 'gt' || name === 'gte') {
      return new CosmFunctionValue(name, (args, selfValue) => {
        if (!(selfValue instanceof CosmNumberValue)) {
          throw new Error(`Type error: ${name} expects a numeric receiver`);
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method ${name} expects 1 arguments, got ${args.length}`);
        }
        const [right] = args;
        if (!(right instanceof CosmNumberValue)) {
          throw new Error(`Type error: ${name} expects numeric operands`);
        }
        switch (name) {
          case 'eq':
            return new CosmBoolValue(selfValue.value === right.value);
          case 'lt':
            return new CosmBoolValue(selfValue.value < right.value);
          case 'lte':
            return new CosmBoolValue(selfValue.value <= right.value);
          case 'gt':
            return new CosmBoolValue(selfValue.value > right.value);
          case 'gte':
        return new CosmBoolValue(selfValue.value >= right.value);
        }
      });
    }
    if (name === 'to_i') {
      return new CosmFunctionValue('to_i', (args, selfValue) => {
        if (!(selfValue instanceof CosmNumberValue)) {
          throw new Error('Type error: to_i expects a numeric receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method to_i expects 0 arguments, got ${args.length}`);
        }
        return new CosmNumberValue(Math.trunc(selfValue.value));
      });
    }
    if (name === 'to_f') {
      return new CosmFunctionValue('to_f', (args, selfValue) => {
        if (!(selfValue instanceof CosmNumberValue)) {
          throw new Error('Type error: to_f expects a numeric receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method to_f expects 0 arguments, got ${args.length}`);
        }
        return new CosmNumberValue(selfValue.value);
      });
    }
    return undefined;
  }

  override visibleNativeMethodNames(): string[] {
    return ['plus', 'pos', 'neg', 'subtract', 'multiply', 'divide', 'pow', 'lt', 'lte', 'gt', 'gte', 'to_i', 'to_f'];
  }

  override toCosmString(): string {
    return String(this.value);
  }
}
