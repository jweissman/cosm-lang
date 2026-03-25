import { CosmValue, CosmEnv } from "../types";
import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { ValueAdapter } from "../ValueAdapter";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmHashValue } from "./CosmHashValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { RuntimeEquality } from "../runtime/RuntimeEquality";
import { CosmErrorValue } from "./CosmErrorValue";
import { Construct } from "../Construct";
import { CosmSchemaValue } from "./CosmSchemaValue";
import { CosmDataModelValue } from "./CosmDataModelValue";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";


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
      cr: () => new CosmFunctionValue('cr', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: cr expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue("\r");
      }),
      clearLine: () => new CosmFunctionValue('clearLine', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: clearLine expects 0 arguments, got ${args.length}`);
        }
        const width = Math.max(process.stdout.columns ?? 80, 1);
        return new CosmStringValue(`\r${" ".repeat(width)}\r`);
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
      trace: () => new CosmFunctionValue('trace', (args, _selfValue, env) => {
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: trace expects 1 or 2 arguments, got ${args.length}`);
        }
        if (args.length === 1) {
          const inspect = CosmKernelValue.inspectValue(args[0], env);
          process.stdout.write(`${inspect.value}\n`);
          return args[0];
        }
        const [label, value] = args;
        if (!(label instanceof CosmStringValue)) {
          throw new Error("Type error: trace(label, value) expects a string label");
        }
        const inspect = CosmKernelValue.inspectValue(value, env);
        process.stdout.write(`${label.value}: ${inspect.value}\n`);
        return value;
      }),
      readline: () => new CosmFunctionValue('readline', (args) => {
        if (args.length > 1) {
          throw new Error(`Arity error: readline expects 0 or 1 arguments, got ${args.length}`);
        }
        const [prompt] = args;
        if (prompt !== undefined) {
          if (!(prompt instanceof CosmStringValue)) {
            throw new Error("Type error: readline expects an optional string prompt");
          }
        }
        if (process.stdin.isTTY && process.stdout.isTTY) {
          return new CosmStringValue(CosmKernelValue.readlineWithHistory(prompt?.value ?? ""));
        }
        if (prompt !== undefined) {
          process.stdout.write(prompt.value);
        }
        const buffer = Buffer.alloc(1);
        let output = "";
        while (true) {
          const bytesRead = readSync(0, buffer, 0, 1, null);
          if (bytesRead === 0) {
            break;
          }
          const chunk = buffer.toString("utf8", 0, bytesRead);
          if (chunk === "\n") {
            break;
          }
          if (chunk !== "\r") {
            output += chunk;
          }
        }
        return new CosmStringValue(output);
      }),
      readText: () => new CosmFunctionValue('readText', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: readText expects 1 arguments, got ${args.length}`);
        }
        const [pathValue] = args;
        if (!(pathValue instanceof CosmStringValue)) {
          throw new Error("Type error: readText expects a string path");
        }
        return new CosmStringValue(readFileSync(resolve(process.cwd(), pathValue.value), "utf8"));
      }),
      writeText: () => new CosmFunctionValue('writeText', (args) => {
        if (args.length !== 2) {
          throw new Error(`Arity error: writeText expects 2 arguments, got ${args.length}`);
        }
        const [pathValue, contentValue] = args;
        if (!(pathValue instanceof CosmStringValue)) {
          throw new Error("Type error: writeText expects a string path");
        }
        if (!(contentValue instanceof CosmStringValue)) {
          throw new Error("Type error: writeText expects string content");
        }
        const targetPath = resolve(process.cwd(), pathValue.value);
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, contentValue.value, "utf8");
        return contentValue;
      }),
      listDir: () => new CosmFunctionValue('listDir', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: listDir expects 1 arguments, got ${args.length}`);
        }
        const [pathValue] = args;
        if (!(pathValue instanceof CosmStringValue)) {
          throw new Error("Type error: listDir expects a string path");
        }
        const targetPath = resolve(process.cwd(), pathValue.value);
        if (!existsSync(targetPath)) {
          return new CosmArrayValue([]);
        }
        return new CosmArrayValue(
          readdirSync(targetPath, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => new CosmStringValue(entry.name))
            .sort((left, right) => left.value.localeCompare(right.value)),
        );
      }),
      exists: () => new CosmFunctionValue('exists', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: exists expects 1 arguments, got ${args.length}`);
        }
        const [pathValue] = args;
        if (!(pathValue instanceof CosmStringValue)) {
          throw new Error("Type error: exists expects a string path");
        }
        return new CosmBoolValue(existsSync(resolve(process.cwd(), pathValue.value)));
      }),
      json: () => new CosmFunctionValue('json', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: json expects 1 arguments, got ${args.length}`);
        }
        return new CosmStringValue(JSON.stringify(ValueAdapter.cosmToJS(args[0])));
      }),
      parseJson: () => new CosmFunctionValue('parseJson', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: parseJson expects 1 arguments, got ${args.length}`);
        }
        const [value] = args;
        if (!(value instanceof CosmStringValue)) {
          throw new Error("Type error: parseJson expects a string");
        }
        return ValueAdapter.jsToCosm(JSON.parse(value.value));
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
      tryValidate: () => new CosmFunctionValue('tryValidate', (args) => {
        if (args.length !== 2) {
          throw new Error(`Arity error: tryValidate expects 2 arguments, got ${args.length}`);
        }
        const [value, target] = args;
        try {
          const schema = CosmKernelValue.expectSchemaOrModel(target);
          return CosmKernelValue.resultNamespace(schema.validateAndReturn(value));
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
        inspect: this.inspectValue(value as CosmValue),
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
    throw new Error("Type error: tryValidate expects a Schema or DataModel target");
  }

  private static readlineWithHistory(prompt: string): string {
    const script = `
const fs = require("node:fs");
const readline = require("node:readline");
const prompt = process.argv[1] ?? "";
const historyPath = process.argv[2];
let persistedHistory = [];
if (historyPath && fs.existsSync(historyPath)) {
  persistedHistory = fs.readFileSync(historyPath, "utf8")
    .split("\\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stderr,
  terminal: true,
  historySize: 500,
});
rl.history = [...persistedHistory].reverse();
rl.question(prompt, (answer) => {
  const trimmed = answer.trim();
  if (trimmed.length > 0 && historyPath) {
    const nextHistory = [...persistedHistory.filter((entry) => entry !== trimmed), trimmed].slice(-500);
    fs.writeFileSync(historyPath, nextHistory.join("\\n") + "\\n", "utf8");
  }
  process.stdout.write(answer);
  rl.close();
});
`;
    const result = execFileSync(process.execPath, ["-e", script, prompt, this.readlineHistoryPath()], {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "inherit"],
    });
    return result.replace(/\r?\n$/, "");
  }

  private static readlineHistoryPath(): string {
    const entrypoint = process.argv[2];
    if (!entrypoint || entrypoint.startsWith("-")) {
      return join(process.cwd(), ".cosm_history");
    }
    const base = entrypoint
      .replace(/^.*[\\/]/, "")
      .replace(/\.[^.]+$/, "")
      .replace(/[^A-Za-z0-9_-]+/g, "_");
    return join(process.cwd(), `.cosm_history_${base || "run"}`);
  }
}
