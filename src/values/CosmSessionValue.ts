import { CosmEnv, CosmValue } from "../types";
import { RuntimeValueManifest, manifestClassMethods, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmErrorValue } from "./CosmErrorValue";
import { ValueAdapter } from "../ValueAdapter";
import { Construct } from "../Construct";

type SessionHistoryEntry = {
  source: string;
  ok: boolean;
  inspect: string;
  error?: CosmErrorValue;
};

export class CosmSessionValue extends CosmObjectValue {
  private static evalInEnvHandler?: (source: string, env: CosmEnv) => CosmValue;
  private static createEnvHandler?: () => CosmEnv;
  private static wrapErrorHandler?: (error: unknown) => CosmErrorValue;
  private static defaultSessionHandler?: () => CosmSessionValue;
  private static nextId = 1;

  static installRuntimeHooks(hooks: {
    evalInEnv: (source: string, env: CosmEnv) => CosmValue;
    createEnv: () => CosmEnv;
    wrapError: (error: unknown) => CosmErrorValue;
    defaultSession: () => CosmSessionValue;
  }): void {
    this.evalInEnvHandler = hooks.evalInEnv;
    this.createEnvHandler = hooks.createEnv;
    this.wrapErrorHandler = hooks.wrapError;
    this.defaultSessionHandler = hooks.defaultSession;
  }

  static readonly manifest: RuntimeValueManifest<CosmSessionValue> = {
    properties: {
      name: (self) => new CosmStringValue(self.sessionName),
      length: (self) => new CosmNumberValue(self.historyEntries.length),
      lastResult: (self) => self.lastResultValue ?? Construct.bool(false),
      lastError: (self) => self.lastErrorValue ?? Construct.bool(false),
    },
    methods: {
      eval: () => new CosmFunctionValue("eval", (args, selfValue) => {
        if (!(selfValue instanceof CosmSessionValue)) {
          throw new Error("Type error: eval expects a Session receiver");
        }
        const source = selfValue.expectSource(args, "Session.eval");
        return selfValue.evalSource(source);
      }),
      tryEval: () => new CosmFunctionValue("tryEval", (args, selfValue) => {
        if (!(selfValue instanceof CosmSessionValue)) {
          throw new Error("Type error: tryEval expects a Session receiver");
        }
        const source = selfValue.expectSource(args, "Session.tryEval");
        return selfValue.tryEvalSource(source);
      }),
      reset: () => new CosmFunctionValue("reset", (args, selfValue) => {
        if (!(selfValue instanceof CosmSessionValue)) {
          throw new Error("Type error: reset expects a Session receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Session.reset expects 0 arguments, got ${args.length}`);
        }
        selfValue.reset();
        return new CosmBoolValue(true);
      }),
      history: () => new CosmFunctionValue("history", (args, selfValue) => {
        if (!(selfValue instanceof CosmSessionValue)) {
          throw new Error("Type error: history expects a Session receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Session.history expects 0 arguments, got ${args.length}`);
        }
        return selfValue.history();
      }),
      inspect: () => new CosmFunctionValue("inspect", (args, selfValue) => {
        if (!(selfValue instanceof CosmSessionValue)) {
          throw new Error("Type error: inspect expects a Session receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Session.inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(`#<Session ${JSON.stringify(selfValue.sessionName)} history: ${selfValue.historyEntries.length}>`);
      }),
      to_s: () => new CosmFunctionValue("to_s", (args, selfValue) => {
        if (!(selfValue instanceof CosmSessionValue)) {
          throw new Error("Type error: to_s expects a Session receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Session.to_s expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(`#<Session ${selfValue.sessionName}>`);
      }),
    },
    classMethods: {
      default: () => new CosmFunctionValue("default", (_args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Session.default expects a class receiver");
        }
        if (_args.length !== 0) {
          throw new Error(`Arity error: Session.default expects 0 arguments, got ${_args.length}`);
        }
        if (!CosmSessionValue.defaultSessionHandler) {
          throw new Error("Session runtime error: default session handler is not installed");
        }
        return CosmSessionValue.defaultSessionHandler();
      }),
    },
  };

  static bootClassMethods(): Record<string, CosmFunctionValue> {
    return manifestClassMethods(CosmSessionValue.manifest);
  }

  private sessionEnv: CosmEnv;
  private historyEntries: SessionHistoryEntry[] = [];
  private lastResultValue?: CosmValue;
  private lastErrorValue?: CosmErrorValue;

  constructor(
    public readonly sessionName: string = `session-${CosmSessionValue.nextId++}`,
    classRef?: CosmClassValue,
    private readonly errorClassRef?: CosmClassValue,
  ) {
    super("Session", {}, classRef);
    if (!CosmSessionValue.createEnvHandler) {
      throw new Error("Session runtime error: createEnv handler is not installed");
    }
    this.sessionEnv = CosmSessionValue.createEnvHandler();
  }

  private expectSource(args: CosmValue[], context: string): string {
    if (args.length !== 1) {
      throw new Error(`Arity error: ${context} expects 1 arguments, got ${args.length}`);
    }
    const [source] = args;
    if (!(source instanceof CosmStringValue)) {
      throw new Error(`Type error: ${context} expects a string source`);
    }
    return source.value;
  }

  evalSource(source: string): CosmValue {
    if (!CosmSessionValue.evalInEnvHandler) {
      throw new Error("Session runtime error: eval handler is not installed");
    }
    try {
      const value = CosmSessionValue.evalInEnvHandler(source, this.sessionEnv);
      this.lastResultValue = value;
      this.lastErrorValue = undefined;
      this.record(source, true, ValueAdapter.format(value));
      return value;
    } catch (error) {
      const wrapped = this.wrapError(error);
      this.lastErrorValue = wrapped;
      this.record(source, false, wrapped.toDisplayString(), wrapped);
      throw error;
    }
  }

  tryEvalSource(source: string): CosmValue {
    if (!CosmSessionValue.evalInEnvHandler) {
      throw new Error("Session runtime error: eval handler is not installed");
    }
    try {
      const value = CosmSessionValue.evalInEnvHandler(source, this.sessionEnv);
      this.lastResultValue = value;
      this.lastErrorValue = undefined;
      const inspect = ValueAdapter.format(value);
      this.record(source, true, inspect);
      return this.resultNamespace(value);
    } catch (error) {
      const wrapped = this.wrapError(error);
      this.lastErrorValue = wrapped;
      this.record(source, false, wrapped.toDisplayString(), wrapped);
      return this.resultNamespace(false, wrapped);
    }
  }

  reset(): void {
    if (!CosmSessionValue.createEnvHandler) {
      throw new Error("Session runtime error: createEnv handler is not installed");
    }
    this.sessionEnv = CosmSessionValue.createEnvHandler();
    this.historyEntries = [];
    this.lastResultValue = undefined;
    this.lastErrorValue = undefined;
  }

  history(): CosmArrayValue {
    return new CosmArrayValue(this.historyEntries.map((entry) => Construct.hash({
      source: new CosmStringValue(entry.source),
      ok: new CosmBoolValue(entry.ok),
      inspect: new CosmStringValue(entry.inspect),
      error: entry.error ?? Construct.bool(false),
    })));
  }

  private resultNamespace(value: CosmValue, error: unknown = false): CosmNamespaceValue {
    const wrappedError = error === false ? false : this.wrapError(error);
    return new CosmNamespaceValue({
      ok: new CosmBoolValue(wrappedError === false),
      value: wrappedError === false ? value : Construct.bool(false),
      inspect: new CosmStringValue(
        wrappedError === false
          ? ValueAdapter.format(value)
          : wrappedError.toDisplayString(),
      ),
      error: wrappedError === false ? Construct.bool(false) : wrappedError,
    });
  }

  private wrapError(error: unknown): CosmErrorValue {
    if (!CosmSessionValue.wrapErrorHandler) {
      throw new Error("Session runtime error: wrapError handler is not installed");
    }
    return CosmSessionValue.wrapErrorHandler(error);
  }

  private record(source: string, ok: boolean, inspect: string, error?: CosmErrorValue): void {
    this.historyEntries.push({ source, ok, inspect, error });
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmSessionValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== "inspect" && name !== "to_s") {
      return inherited;
    }
    return manifestMethod(this, name, CosmSessionValue.manifest);
  }
}
