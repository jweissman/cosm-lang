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
import { CosmErrorValue } from "./CosmErrorValue";
import { Construct } from "../Construct";
import { CosmSchemaValue } from "./CosmSchemaValue";
import { CosmDataModelValue } from "./CosmDataModelValue";


export class CosmKernelValue extends CosmObjectValue {
  private static sendHandler?: (receiver: CosmValue, message: CosmValue, args: CosmValue[], env?: CosmEnv) => CosmValue;
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  private static evalHandler?: (source: string) => CosmValue;
  private static resetEvalHandler?: () => void;
  private static defaultSessionHandler?: () => CosmValue;
  private static wrapErrorHandler?: (error: unknown) => CosmErrorValue;
  private static testPassed = 0;
  private static testFailed = 0;

  static installRuntimeHooks(hooks: {
    send: (receiver: CosmValue, message: CosmValue, args: CosmValue[], env?: CosmEnv) => CosmValue;
    invoke: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
    eval?: (source: string) => CosmValue;
    resetEval?: () => void;
    defaultSession?: () => CosmValue;
    wrapError?: (error: unknown) => CosmErrorValue;
  }): void {
    this.sendHandler = hooks.send;
    this.invokeHandler = hooks.invoke;
    this.evalHandler = hooks.eval;
    this.resetEvalHandler = hooks.resetEval;
    this.defaultSessionHandler = hooks.defaultSession;
    this.wrapErrorHandler = hooks.wrapError;
  }

  constructor(fields: Record<string, CosmValue>, classRef?: CosmClassValue) {
    super('Kernel', fields, classRef);
  }

  private static messageName(value: CosmValue): string | undefined {
    if (value.type === 'symbol') {
      return value.name;
    }
    if (value.type === 'string') {
      return value.value;
    }
    return undefined;
  }

  private static canHandleSelfSend(selfValue: CosmValue | undefined, messageValue: CosmValue): boolean {
    if (!selfValue) {
      return false;
    }
    const message = CosmKernelValue.messageName(messageValue);
    if (!message) {
      return false;
    }
    return selfValue.nativeMethod(message) !== undefined;
  }

  static readonly manifest: RuntimeValueManifest<CosmKernelValue> = {
    methods: {
      assert: () => new CosmFunctionValue('assert', (args) => {
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: assert expects 1 or 2 arguments, got ${args.length}`);
        }
        const [condition, message] = args;
        if (!(condition instanceof CosmBoolValue)) {
          CosmErrorValue.raise(new CosmStringValue('Type error: assert expects a boolean argument'));
        }
        if (!condition.value) {
          if (message) {
            if (!(message instanceof CosmStringValue)) {
              CosmErrorValue.raise(new CosmStringValue('Type error: assert message must be a string'));
            }
            CosmErrorValue.raise(new CosmStringValue(`Assertion failed: ${message.value}`));
          }
          CosmErrorValue.raise(new CosmStringValue('Assertion failed'));
        }
        return new CosmBoolValue(true);
      }),
      puts: () => new CosmFunctionValue('puts', (args, _selfValue, env) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: puts expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        const rendered = CosmKernelValue.renderForOutput(value, env);
        process.stdout.write(`${rendered}\n`);
        return value;
      }),
      print: () => new CosmFunctionValue('print', (args, _selfValue, env) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: print expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        const rendered = CosmKernelValue.renderForOutput(value, env);
        process.stdout.write(rendered);
        return value;
      }),
      warn: () => new CosmFunctionValue('warn', (args, _selfValue, env) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: warn expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        const rendered = CosmKernelValue.renderForOutput(value, env);
        process.stderr.write(`${rendered}\n`);
        return value;
      }),
      inspect: () => new CosmFunctionValue('inspect', (args, selfValue, env) => {
        if (args.length === 0) {
          if (!selfValue) {
            throw new Error('Type error: inspect expects a receiver');
          }
          return CosmKernelValue.inspectValue(selfValue, env);
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: inspect expects 0 or 1 arguments, got ${args.length}`);
        }
        return CosmKernelValue.inspectValue(args[0], env);
      }),
      escapeHtml: () => new CosmFunctionValue('escapeHtml', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: escapeHtml expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        if (!(value instanceof CosmStringValue)) {
          throw new Error('Type error: escapeHtml expects a string');
        }
        return new CosmStringValue(
          value.value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;'),
        );
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
      raise: () => new CosmFunctionValue('raise', (args) => {
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: raise expects 1 or 2 arguments, got ${args.length}`);
        }
        const [errorOrMessage, details] = args;
        CosmErrorValue.raise(errorOrMessage, undefined, details);
      }),
      try: () => new CosmFunctionValue('try', (args, _selfValue, env) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: try expects 1 arguments, got ${args.length}`);
        }
        if (!CosmKernelValue.invokeHandler) {
          throw new Error('Kernel runtime error: invoke handler is not installed');
        }
        const [callable] = args;
        try {
          const value = CosmKernelValue.invokeHandler(callable, [], undefined, env);
          return CosmKernelValue.resultNamespace(value);
        } catch (error) {
          return CosmKernelValue.resultNamespace(false, error);
        }
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
          return CosmKernelValue.resultNamespace(value);
        } catch (error) {
          return CosmKernelValue.resultNamespace(false, error);
        }
      }),
      resetSession: () => new CosmFunctionValue('resetSession', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: resetSession expects 0 arguments, got ${args.length}`);
        }
        CosmKernelValue.resetEvalHandler?.();
        return new CosmBoolValue(true);
      }),
      blockGiven: () => new CosmFunctionValue('blockGiven', (args, _selfValue, env) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: blockGiven expects 0 arguments, got ${args.length}`);
        }
        return new CosmBoolValue(CosmKernelValue.currentBlock(env) !== undefined);
      }),
      sleep: () => new CosmFunctionValue('sleep', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: sleep expects 1 arguments, got ${args.length}`);
        }
        const [milliseconds] = args;
        if (!(milliseconds instanceof CosmNumberValue) || !Number.isFinite(milliseconds.value) || milliseconds.value < 0) {
          throw new Error('Type error: sleep expects a non-negative numeric duration in milliseconds');
        }
        const timeout = new Int32Array(new SharedArrayBuffer(4));
        Atomics.wait(timeout, 0, 0, milliseconds.value);
        return milliseconds;
      }),
      uuid: () => new CosmFunctionValue('uuid', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: uuid expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(crypto.randomUUID());
      }),
      send: () => new CosmFunctionValue('send', (args, _selfValue, env) => {
        if (!CosmKernelValue.sendHandler) {
          throw new Error('Kernel runtime error: send handler is not installed');
        }
        if (CosmKernelValue.canHandleSelfSend(_selfValue, args[0])) {
          const [messageValue, ...messageArgs] = args;
          return CosmKernelValue.sendHandler(_selfValue!, messageValue, messageArgs, env);
        }
        if (args.length < 2) {
          throw new Error(`Arity error: Kernel.send expects at least 2 arguments, got ${args.length}`);
        }
        const [receiver, messageValue, ...messageArgs] = args;
        return CosmKernelValue.sendHandler(receiver, messageValue, messageArgs, env);
      }),
      dispatch: () => new CosmFunctionValue('dispatch', (args, _selfValue, env) => {
        if (args.length < 2) {
          throw new Error(`Arity error: Kernel.dispatch expects at least 2 arguments, got ${args.length}`);
        }
        if (!CosmKernelValue.sendHandler) {
          throw new Error('Kernel runtime error: send handler is not installed');
        }
        const [receiver, messageValue, ...messageArgs] = args;
        return CosmKernelValue.sendHandler(receiver, messageValue, messageArgs, env);
      }),
      tryCast: () => new CosmFunctionValue('tryCast', (args) => {
        if (args.length !== 2) {
          throw new Error(`Arity error: tryCast expects 2 arguments, got ${args.length}`);
        }
        const [value, target] = args;
        try {
          const schema = CosmKernelValue.expectSchemaOrModel(target);
          const cast = schema.nativeMethod("cast");
          if (!cast || !cast.nativeCall) {
            throw new Error("Kernel runtime error: Schema.cast is not available");
          }
          return CosmKernelValue.resultNamespace(cast.nativeCall([value], schema));
        } catch (error) {
          return CosmKernelValue.resultNamespace(false, error);
        }
      }),
      session: () => new CosmFunctionValue('session', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: session expects 0 arguments, got ${args.length}`);
        }
        if (!CosmKernelValue.defaultSessionHandler) {
          throw new Error('Kernel runtime error: default session handler is not installed');
        }
        return CosmKernelValue.defaultSessionHandler();
      }),
      expectEqual: () => new CosmFunctionValue('expectEqual', (args) => {
        if (args.length < 2 || args.length > 3) {
          throw new Error(`Arity error: expectEqual expects 2 or 3 arguments, got ${args.length}`);
        }
        const [actual, expected, message] = args;
        if (!RuntimeEquality.compare(actual, expected)) {
          if (message) {
            if (!(message instanceof CosmStringValue)) {
              CosmErrorValue.raise(new CosmStringValue('Type error: expectEqual message must be a string'));
            }
            CosmErrorValue.raise(new CosmStringValue(`Expectation failed: ${message.value}`));
          }
          CosmErrorValue.raise(new CosmStringValue(`Expectation failed: expected ${ValueAdapter.format(expected)}, got ${ValueAdapter.format(actual)}`));
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

  private static resultNamespace(value: CosmValue | false, error?: unknown): CosmNamespaceValue {
    if (!error) {
      return new CosmNamespaceValue({
        ok: new CosmBoolValue(true),
        value: value as CosmValue,
        inspect: new CosmStringValue(ValueAdapter.format(value as CosmValue)),
        error: new CosmBoolValue(false),
      });
    }
    const wrapped = CosmKernelValue.wrapErrorHandler
      ? CosmKernelValue.wrapErrorHandler(error)
      : CosmErrorValue.fromUnknown(error);
    return new CosmNamespaceValue({
      ok: new CosmBoolValue(false),
      value: new CosmBoolValue(false),
      inspect: new CosmBoolValue(false),
      error: wrapped,
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
    if (inherited && name !== 'send' && name !== 'inspect') {
      return inherited;
    }
    return manifestMethod(this, name, CosmKernelValue.manifest);
  }

  private static inspectValue(target: CosmValue, env?: CosmEnv): CosmStringValue {
    if (target instanceof CosmKernelValue) {
      return new CosmStringValue(ValueAdapter.format(target));
    }
    if (!CosmKernelValue.sendHandler) {
      return new CosmStringValue(ValueAdapter.format(target));
    }
    const rendered = CosmKernelValue.sendHandler(target, Construct.symbol("inspect"), [], env);
    if (!(rendered instanceof CosmStringValue)) {
      throw new Error('Type error: inspect must return a string');
    }
    return rendered;
  }

  private static renderForOutput(value: CosmValue, env?: CosmEnv): string {
    if (value instanceof CosmStringValue) {
      return value.value;
    }
    if (!CosmKernelValue.sendHandler) {
      return ValueAdapter.format(value);
    }
    const rendered = CosmKernelValue.sendHandler(value, Construct.symbol("to_s"), [], env);
    if (!(rendered instanceof CosmStringValue)) {
      throw new Error('Type error: to_s must return a string');
    }
    return rendered.value;
  }

  private static currentBlock(env?: CosmEnv): CosmValue | undefined {
    for (let scope = env; scope; scope = scope.parent) {
      if (scope.currentBlock) {
        return scope.currentBlock;
      }
    }
    return undefined;
  }

  private static expectSchemaOrModel(target: CosmValue): CosmSchemaValue {
    if (target instanceof CosmSchemaValue) {
      return target;
    }
    if (target instanceof CosmDataModelValue) {
      return target.toSchema();
    }
    throw new Error("Type error: tryCast expects a Schema or DataModel target");
  }
}
