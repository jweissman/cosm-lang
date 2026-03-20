import { CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { ValueAdapter } from "../ValueAdapter";


export class CosmKernelValue extends CosmObjectValue {
  private static sendHandler?: (receiver: CosmValue, message: CosmValue, args: CosmValue[]) => CosmValue;
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue) => CosmValue;

  static installRuntimeHooks(hooks: {
    send: (receiver: CosmValue, message: CosmValue, args: CosmValue[]) => CosmValue;
    invoke: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue) => CosmValue;
  }): void {
    this.sendHandler = hooks.send;
    this.invokeHandler = hooks.invoke;
  }

  constructor(fields: Record<string, CosmValue>, classRef?: CosmClassValue) {
    super('Kernel', fields, classRef);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    if (name === 'assert') {
      return new CosmFunctionValue('assert', (args) => {
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: assert expects 1 or 2 arguments, got ${args.length}`);
        }
        const [condition, message] = args;
        if (!(condition instanceof CosmBoolValue)) {
          throw new Error('Type error: assert expects a boolean argument');
        }
        if (!condition.value) {
          if (message) {
            if (!(message instanceof CosmStringValue)) {
              throw new Error('Type error: assert message must be a string');
            }
            throw new Error(`Assertion failed: ${message.value}`);
          }
          throw new Error('Assertion failed');
        }
        return new CosmBoolValue(true);
      });
    }
    if (name === 'puts') {
      return new CosmFunctionValue('puts', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: puts expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        const rendered = value instanceof CosmStringValue ? value.value : ValueAdapter.format(value);
        process.stdout.write(`${rendered}\n`);
        return value;
      });
    }
    if (name === 'print') {
      return new CosmFunctionValue('print', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: print expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        const rendered = value instanceof CosmStringValue ? value.value : ValueAdapter.format(value);
        process.stdout.write(rendered);
        return value;
      });
    }
    if (name === 'inspect') {
      return new CosmFunctionValue('inspect', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: inspect expects 1 arguments, got ${args.length}`);
        }
        return new CosmStringValue(ValueAdapter.format(args[0]));
      });
    }
    if (name === 'send') {
      return new CosmFunctionValue('send', (args) => {
        if (args.length < 2) {
          throw new Error(`Arity error: Kernel.send expects at least 2 arguments, got ${args.length}`);
        }
        if (!CosmKernelValue.sendHandler) {
          throw new Error('Kernel runtime error: send handler is not installed');
        }
        const [receiver, messageValue, ...messageArgs] = args;
        return CosmKernelValue.sendHandler(receiver, messageValue, messageArgs);
      });
    }
    if (name === 'test') {
      return new CosmFunctionValue('test', (args) => {
        if (args.length !== 2) {
          throw new Error(`Arity error: test expects 2 arguments, got ${args.length}`);
        }
        if (!CosmKernelValue.invokeHandler) {
          throw new Error('Kernel runtime error: invoke handler is not installed');
        }
        const [nameValue, callable] = args;
        if (!(nameValue instanceof CosmStringValue)) {
          throw new Error('Type error: test expects a string name');
        }
        try {
          CosmKernelValue.invokeHandler(callable, []);
          process.stdout.write(`ok - ${nameValue.value}\n`);
          return new CosmBoolValue(true);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          process.stdout.write(`not ok - ${nameValue.value}: ${message}\n`);
          return new CosmBoolValue(false);
        }
      });
    }
    return undefined;
  }
}
