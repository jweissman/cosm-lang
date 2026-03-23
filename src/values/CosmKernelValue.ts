import { CosmValue, CosmEnv } from "../types";
import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { ValueAdapter } from "../ValueAdapter";
import { CosmHashValue } from "./CosmHashValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { RuntimeEquality } from "../runtime/RuntimeEquality";


export class CosmKernelValue extends CosmObjectValue {
  private static sendHandler?: (receiver: CosmValue, message: CosmValue, args: CosmValue[]) => CosmValue;
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  private static evalHandler?: (source: string) => CosmValue;
  private static testPassed = 0;
  private static testFailed = 0;

  static installRuntimeHooks(hooks: {
    send: (receiver: CosmValue, message: CosmValue, args: CosmValue[]) => CosmValue;
    invoke: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
    eval?: (source: string) => CosmValue;
  }): void {
    this.sendHandler = hooks.send;
    this.invokeHandler = hooks.invoke;
    this.evalHandler = hooks.eval;
  }

  constructor(fields: Record<string, CosmValue>, classRef?: CosmClassValue) {
    super('Kernel', fields, classRef);
  }

  static readonly manifest: RuntimeValueManifest<CosmKernelValue> = {
    methods: {
      assert: () => new CosmFunctionValue('assert', (args) => {
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
      }),
      puts: () => new CosmFunctionValue('puts', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: puts expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        const rendered = value instanceof CosmStringValue ? value.value : ValueAdapter.format(value);
        process.stdout.write(`${rendered}\n`);
        return value;
      }),
      print: () => new CosmFunctionValue('print', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: print expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        const rendered = value instanceof CosmStringValue ? value.value : ValueAdapter.format(value);
        process.stdout.write(rendered);
        return value;
      }),
      warn: () => new CosmFunctionValue('warn', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: warn expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        const rendered = value instanceof CosmStringValue ? value.value : ValueAdapter.format(value);
        process.stderr.write(`${rendered}\n`);
        return value;
      }),
      inspect: () => new CosmFunctionValue('inspect', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: inspect expects 1 arguments, got ${args.length}`);
        }
        return new CosmStringValue(ValueAdapter.format(args[0]));
      }),
      eval: () => new CosmFunctionValue('eval', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: eval expects 1 arguments, got ${args.length}`);
        }
        if (!CosmKernelValue.evalHandler) {
          throw new Error('Kernel runtime error: eval handler is not installed');
        }
        const [source] = args;
        if (!(source instanceof CosmStringValue)) {
          throw new Error('Type error: eval expects a string source');
        }
        return CosmKernelValue.evalHandler(source.value);
      }),
      tryEval: () => new CosmFunctionValue('tryEval', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: tryEval expects 1 arguments, got ${args.length}`);
        }
        if (!CosmKernelValue.evalHandler) {
          throw new Error('Kernel runtime error: eval handler is not installed');
        }
        const [source] = args;
        if (!(source instanceof CosmStringValue)) {
          throw new Error('Type error: tryEval expects a string source');
        }
        try {
          const value = CosmKernelValue.evalHandler(source.value);
          return new CosmNamespaceValue({
            ok: new CosmBoolValue(true),
            value,
            inspect: new CosmStringValue(ValueAdapter.format(value)),
            error: new CosmBoolValue(false),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return new CosmNamespaceValue({
            ok: new CosmBoolValue(false),
            value: new CosmBoolValue(false),
            inspect: new CosmBoolValue(false),
            error: new CosmStringValue(message),
          });
        }
      }),
      sleep: () => new CosmFunctionValue('sleep', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: sleep expects 1 arguments, got ${args.length}`);
        }
        const [milliseconds] = args;
        if (!(milliseconds instanceof CosmNumberValue) || !Number.isFinite(milliseconds.value) || milliseconds.value < 0) {
          throw new Error('Type error: sleep expects a non-negative numeric duration in milliseconds');
        }
        const start = Date.now();
        while (Date.now() - start < milliseconds.value) {
          // Busy-waiting is acceptable for the tiny synchronous runtime surface in 0.3.1.
        }
        return milliseconds;
      }),
      send: () => new CosmFunctionValue('send', (args) => {
        if (args.length < 2) {
          throw new Error(`Arity error: Kernel.send expects at least 2 arguments, got ${args.length}`);
        }
        if (!CosmKernelValue.sendHandler) {
          throw new Error('Kernel runtime error: send handler is not installed');
        }
        const [receiver, messageValue, ...messageArgs] = args;
        return CosmKernelValue.sendHandler(receiver, messageValue, messageArgs);
      }),
      expectEqual: () => new CosmFunctionValue('expectEqual', (args) => {
        if (args.length < 2 || args.length > 3) {
          throw new Error(`Arity error: expectEqual expects 2 or 3 arguments, got ${args.length}`);
        }
        const [actual, expected, message] = args;
        if (!RuntimeEquality.compare(actual, expected)) {
          if (message) {
            if (!(message instanceof CosmStringValue)) {
              throw new Error('Type error: expectEqual message must be a string');
            }
            throw new Error(`Expectation failed: ${message.value}`);
          }
          throw new Error(`Expectation failed: expected ${ValueAdapter.format(expected)}, got ${ValueAdapter.format(actual)}`);
        }
        return new CosmBoolValue(true);
      }),
      test: () => new CosmFunctionValue('test', (args, _selfValue, env) => {
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
          CosmKernelValue.invokeHandler(callable, [], undefined, env);
          CosmKernelValue.testPassed += 1;
          process.stdout.write(`ok - ${nameValue.value}\n`);
          return new CosmBoolValue(true);
        } catch (error) {
          CosmKernelValue.testFailed += 1;
          const message = error instanceof Error ? error.message : String(error);
          process.stdout.write(`not ok - ${nameValue.value}: ${message}\n`);
          return new CosmBoolValue(false);
        }
      }),
      describe: () => new CosmFunctionValue('describe', (args, _selfValue, env) => {
        if (args.length !== 2) {
          throw new Error(`Arity error: describe expects 2 arguments, got ${args.length}`);
        }
        if (!CosmKernelValue.invokeHandler) {
          throw new Error('Kernel runtime error: invoke handler is not installed');
        }
        const [nameValue, callable] = args;
        if (!(nameValue instanceof CosmStringValue)) {
          throw new Error('Type error: describe expects a string name');
        }
        process.stdout.write(`# ${nameValue.value}\n`);
        return CosmKernelValue.invokeHandler(callable, [], undefined, env);
      }),
      resetTests: () => new CosmFunctionValue('resetTests', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: resetTests expects 0 arguments, got ${args.length}`);
        }
        CosmKernelValue.testPassed = 0;
        CosmKernelValue.testFailed = 0;
        return new CosmBoolValue(true);
      }),
      testSummary: () => new CosmFunctionValue('testSummary', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: testSummary expects 0 arguments, got ${args.length}`);
        }
        return CosmKernelValue.testSummaryValue();
      }),
    },
  };

  private static testSummaryValue(): CosmHashValue {
    return new CosmHashValue({
      passed: new CosmNumberValue(this.testPassed),
      failed: new CosmNumberValue(this.testFailed),
      total: new CosmNumberValue(this.testPassed + this.testFailed),
    });
  }

  static createTestNamespace(
    kernelMethods: Record<string, CosmFunctionValue>,
    namespaceClass?: CosmClassValue,
  ): CosmObjectValue {
    return new CosmNamespaceValue({
      test: kernelMethods.test,
      describe: kernelMethods.describe,
      expectEqual: kernelMethods.expectEqual,
      reset: kernelMethods.resetTests,
      summary: kernelMethods.testSummary,
    }, namespaceClass);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== 'send') {
      return inherited;
    }
    return manifestMethod(this, name, CosmKernelValue.manifest);
  }
}
