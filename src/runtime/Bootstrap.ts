import { Construct } from "../Construct";
import { CosmClass, CosmEnv, CosmFunction, CosmObject, CosmValue } from "../types";
import { manifestClassMethods, manifestMethods } from "./RuntimeManifest";
import { CosmClassValue } from "../values/CosmClassValue";
import { CosmFunctionValue } from "../values/CosmFunctionValue";
import { CosmKernelValue } from "../values/CosmKernelValue";
import { CosmMethodValue } from "../values/CosmMethodValue";
import { CosmModuleValue } from "../values/CosmModuleValue";
import { CosmNamespaceValue } from "../values/CosmNamespaceValue";
import { CosmArrayValue } from "../values/CosmArrayValue";
import { CosmHashValue } from "../values/CosmHashValue";
import { CosmProcessValue } from "../values/CosmProcessValue";
import { CosmRandomValue } from "../values/CosmRandomValue";
import { CosmSymbolValue } from "../values/CosmSymbolValue";
import { CosmTimeValue } from "../values/CosmTimeValue";
import { CosmValueBase } from "../values/CosmValueBase";
import { CosmObjectValue } from "../values/CosmObjectValue";
import { CosmHttpValue } from "../values/CosmHttpValue";
import { CosmHttpRequestValue } from "../values/CosmHttpRequestValue";
import { CosmHttpResponseValue } from "../values/CosmHttpResponseValue";
import { CosmHttpServerValue } from "../values/CosmHttpServerValue";
import { CosmHttpRouterValue } from "../values/CosmHttpRouterValue";
import { CosmMirrorValue } from "../values/CosmMirrorValue";
import { CosmErrorValue } from "../values/CosmErrorValue";
import { CosmSchemaValue } from "../values/CosmSchemaValue";
import { CosmPromptValue } from "../values/CosmPromptValue";
import { CosmAiValue } from "../values/CosmAiValue";
import { CosmSessionValue } from "../values/CosmSessionValue";
import { CosmDataModelValue } from "../values/CosmDataModelValue";
import { RuntimeDispatch } from "./RuntimeDispatch";
import { RuntimeEquality } from "./RuntimeEquality";
import { AiRuntime } from "./AiRuntime";
import { SessionRuntime } from "./SessionRuntime";

export type RuntimeRepository = {
  globals: Record<string, CosmValue>;
  classes: Record<string, CosmClass>;
  modules: Record<string, CosmObject>;
};

type BootstrapRuntime = {
  invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv, currentBlock?: CosmValue) => CosmValue;
  instantiateClass: (classValue: CosmClass, args: CosmValue[]) => CosmObject;
  invokeSend: (receiver: CosmValue, messageValue: CosmValue, args: CosmValue[], env?: CosmEnv) => CosmValue;
  classOf: (value: CosmValue) => CosmClass;
  internSymbol: (name: string) => CosmValue;
  loadModule: (name: string, env: CosmEnv) => CosmObject | undefined;
  evalSource: (source: string) => CosmValue;
  evalInEnv: (source: string, env: CosmEnv) => CosmValue;
  inspectValue: (value: CosmValue, env?: CosmEnv) => string;
  createSessionEnv: () => CosmEnv;
  defaultSession: () => CosmValue;
  resetEvalSource?: () => void;
};

export class Bootstrap {
  static createRepository(runtime: BootstrapRuntime): RuntimeRepository {
    this.installRuntimeHooks(runtime);

    const classes = this.createCoreClasses();
    this.installBootNativeMethods(classes, runtime);

    const globals = this.createCoreGlobals(classes);
    const modules = this.createCoreModules(classes);
    this.installKernelGlobals(globals, classes, modules, runtime);

    return { globals, classes, modules };
  }

  private static installRuntimeHooks(runtime: BootstrapRuntime): void {
    const namedSessions = new Map<string, CosmSessionValue>();
    CosmKernelValue.installRuntimeHooks({
      send: (receiver, messageValue, args, env) => runtime.invokeSend(receiver, messageValue, args, env),
      invoke: (callee, args, selfValue, env) => runtime.invokeFunction(callee, args, selfValue, env),
      eval: (source) => runtime.evalSource(source),
      resetEval: () => runtime.resetEvalSource?.(),
      defaultSession: () => runtime.defaultSession(),
      wrapError: (error) => CosmErrorValue.fromUnknown(error, this.currentRepository?.classes.Error),
    });
    CosmProcessValue.installRuntimeHooks({});
    CosmFunctionValue.installRuntimeHooks({
      invoke: (callee, args, selfValue, env) => runtime.invokeFunction(callee, args, selfValue, env),
    });
    CosmArrayValue.installRuntimeHooks({
      invoke: (callee, args, selfValue, env) => runtime.invokeFunction(callee, args, selfValue, env),
    });
    CosmHashValue.installRuntimeHooks({
      invoke: (callee, args, selfValue, env) => runtime.invokeFunction(callee, args, selfValue, env),
    });
    CosmHttpValue.installRuntimeHooks({
      invoke: (callee, args, selfValue, env) => runtime.invokeFunction(callee, args, selfValue, env),
      lookupMethod: (receiver, message) => RuntimeDispatch.reflectMethod(receiver, message, this.currentRepository!),
    });
    CosmHttpRouterValue.installRuntimeHooks({
      invoke: (callee, args, selfValue, env) => runtime.invokeFunction(callee, args, selfValue, env),
      lookupMethod: (receiver, message) => RuntimeDispatch.reflectMethod(receiver, message, this.currentRepository!),
    });
    CosmClassValue.installRuntimeHooks({
      instantiate: (classValue, args) => runtime.instantiateClass(classValue, args),
      lookupClassMethod: (classValue, message) => RuntimeDispatch.reflectClassMethod(classValue, message),
    });
    CosmMirrorValue.installRuntimeHooks({
      classOf: (value) => runtime.classOf(value),
      lookupProperty: (receiver, property) => RuntimeDispatch.lookupProperty(receiver, property, this.currentRepository!),
      visibleMethods: (receiver) => RuntimeDispatch.visibleMethodSymbols(receiver, this.currentRepository!),
    });
    CosmMethodValue.installRuntimeHooks({
      invoke: (callee, args, selfValue) => runtime.invokeFunction(callee, args, selfValue),
    });
    CosmSymbolValue.installRuntimeHooks({
      intern: (name) => runtime.internSymbol(name),
    });
    CosmValueBase.installRuntimeHooks({
      send: (receiver, messageValue, args, env) => runtime.invokeSend(receiver, messageValue, args, env),
      lookupMethod: (receiver, message) => RuntimeDispatch.reflectMethod(receiver, message, this.currentRepository!),
      lookupMethods: (receiver) => RuntimeDispatch.visibleMethodSymbols(receiver, this.currentRepository!),
      classOf: (receiver) => runtime.classOf(receiver),
      equal: (left, right) => RuntimeEquality.compare(left, right),
    });
    CosmAiValue.installRuntimeHooks({
      status: () => AiRuntime.status(this.currentRepository?.classes.Namespace),
      health: () => AiRuntime.health(this.currentRepository?.classes.Namespace),
      complete: (prompt) => AiRuntime.complete(prompt),
      cast: (prompt, schema) => AiRuntime.cast(prompt, schema),
      compare: (left, right) => AiRuntime.compare(left, right),
      stream: (prompt, onEvent) => AiRuntime.stream(prompt, onEvent),
      invoke: (callee, args, selfValue, env) => runtime.invokeFunction(callee, args, selfValue, env),
    });
    CosmSessionValue.installRuntimeHooks({
      createHandle: (name, errorClassRef) => SessionRuntime.createHandle({
        name,
        errorClassRef,
        evalInEnv: (source, env) => runtime.evalInEnv(source, env),
        inspectValue: (value, env) => runtime.inspectValue(value, env),
        createEnv: () => runtime.createSessionEnv(),
        inline: name === "example"
          || ((name.startsWith("slack-") || name.startsWith("agent:"))
            && (process.env.AGENT_INLINE_SESSION === "1" || process.env.COSM_SLACK_INLINE_SESSION === "1")),
      }),
      defaultSession: () => runtime.defaultSession() as CosmSessionValue,
      namedSession: (name) => {
        let existing = namedSessions.get(name);
        if (!existing) {
          existing = new CosmSessionValue(name, this.currentRepository?.classes.Session, this.currentRepository?.classes.Error);
          namedSessions.set(name, existing);
        }
        return existing;
      },
    });
  }

  private static currentRepository?: RuntimeRepository;

  private static createCoreClasses(): Record<string, CosmClass> {
    const objectClass = Construct.class('Object');
    const classClass = Construct.class('Class', 'Object', [], {}, {}, objectClass);
    classClass.classRef = classClass;
    objectClass.classRef = this.createMetaclass('Object', classClass, {}, classClass);

    const classes: Record<string, CosmClass> = {
      Class: classClass,
      Object: objectClass,
    };

    for (const name of ['Number', 'Boolean', 'String', 'Symbol', 'Array', 'Hash', 'Function', 'Method', 'Namespace', 'Module', 'Kernel', 'Process', 'Time', 'Random', 'Mirror', 'Error', 'Schema', 'Prompt', 'Ai', 'Session', 'DataModel', 'Http', 'HttpRequest', 'HttpResponse', 'HttpServer', 'HttpRouter']) {
      classes[name] = this.createBootClass(name, objectClass, classClass);
    }

    return classes;
  }

  private static installBootNativeMethods(classes: Record<string, CosmClass>, _runtime: BootstrapRuntime): void {
    Object.assign(classes.Object.methods, manifestMethods(
      new CosmObjectValue('Object', {}, classes.Object),
      CosmValueBase.manifest,
    ));
    Object.assign(classes.Class.methods, manifestMethods(classes.Class, CosmClassValue.manifest));
    Object.assign(classes.Function.methods, manifestMethods(
      new CosmFunctionValue('noop', () => Construct.bool(true)),
      CosmFunctionValue.manifest,
    ));
    Object.assign(classes.Method.methods, manifestMethods(
      Construct.method('noop', Construct.bool(true), new CosmFunctionValue('noop', () => Construct.bool(true))),
      CosmMethodValue.manifest,
    ));
    Object.assign(classes.Symbol.methods, manifestMethods(
      Construct.symbol('example'),
      CosmSymbolValue.manifest,
    ));
    Object.assign(classes.Namespace.methods, manifestMethods(
      new CosmNamespaceValue({}, classes.Namespace),
      CosmNamespaceValue.manifest,
    ));
    Object.assign(classes.Module.methods, manifestMethods(
      new CosmModuleValue('example/module', {}, classes.Module),
      CosmModuleValue.manifest,
    ));
    Object.assign(classes.Kernel.methods, manifestMethods(
      new CosmKernelValue({}, classes.Kernel),
      CosmKernelValue.manifest,
    ));
    Object.assign(classes.Process.methods, manifestMethods(
      new CosmProcessValue({}, classes.Process),
      CosmProcessValue.manifest,
    ));
    Object.assign(classes.Time.methods, manifestMethods(
      new CosmTimeValue({}, classes.Time),
      CosmTimeValue.manifest,
    ));
    Object.assign(classes.Random.methods, manifestMethods(
      new CosmRandomValue({}, classes.Random),
      CosmRandomValue.manifest,
    ));
    Object.assign(classes.Mirror.methods, manifestMethods(
      new CosmMirrorValue(Construct.bool(true), classes.Mirror),
      CosmMirrorValue.manifest,
    ));
    Object.assign(classes.Error.methods, manifestMethods(
      new CosmErrorValue("example", [], Construct.bool(false), classes.Error),
      CosmErrorValue.manifest,
    ));
    Object.assign(classes.Schema.methods, manifestMethods(
      new CosmSchemaValue("string", {}, classes.Schema, classes.Error),
      CosmSchemaValue.manifest,
    ));
    Object.assign(classes.Prompt.methods, manifestMethods(
      new CosmPromptValue("example", classes.Prompt),
      CosmPromptValue.manifest,
    ));
    Object.assign(classes.Ai.methods, manifestMethods(
      new CosmAiValue({}, classes.Ai, classes.Error),
      CosmAiValue.manifest,
    ));
    Object.assign(classes.Session.methods, manifestMethods(
      new CosmSessionValue("example", classes.Session, classes.Error),
      CosmSessionValue.manifest,
    ));
    Object.assign(classes.DataModel.methods, manifestMethods(
      new CosmDataModelValue("Example", {}, classes.DataModel, classes.Schema, classes.Error, classes.Namespace),
      CosmDataModelValue.manifest,
    ));
    Object.assign(classes.Http.methods, manifestMethods(
      new CosmHttpValue(
        {},
        classes.Http,
        classes.HttpServer,
        classes.Namespace,
        classes.HttpRequest,
        classes.HttpResponse,
      ),
      CosmHttpValue.manifest,
    ));
    Object.assign(classes.HttpRequest.methods, manifestMethods(
      new CosmHttpRequestValue(
        'GET',
        'http://127.0.0.1:0/example',
        '/example',
        new CosmNamespaceValue({}, classes.Namespace),
        new CosmNamespaceValue({}, classes.Namespace),
        '',
        classes.HttpRequest,
      ),
      CosmHttpRequestValue.manifest,
    ));
    Object.assign(classes.HttpResponse.methods, manifestMethods(
      new CosmHttpResponseValue(200, Construct.string('ok'), new CosmNamespaceValue({}, classes.Namespace), classes.HttpResponse),
      CosmHttpResponseValue.manifest,
    ));
    Object.assign(classes.HttpServer.methods, manifestMethods(
      new CosmHttpServerValue(undefined, 0, "", classes.HttpServer),
      CosmHttpServerValue.manifest,
    ));
    Object.assign(classes.HttpRouter.methods, manifestMethods(
      new CosmHttpRouterValue({}, classes.HttpRouter, classes.HttpResponse, classes.Namespace),
      CosmHttpRouterValue.manifest,
    ));
    Object.assign(
      classes.Symbol.classRef?.methods ?? {},
      manifestClassMethods(CosmSymbolValue.manifest),
    );
    Object.assign(
      classes.HttpResponse.classRef?.methods ?? {},
      manifestClassMethods(CosmHttpResponseValue.manifest),
    );
    Object.assign(
      classes.Mirror.classRef?.methods ?? {},
      CosmMirrorValue.bootClassMethods(),
    );
    Object.assign(
      classes.Error.classRef?.methods ?? {},
      CosmErrorValue.bootClassMethods(),
    );
    Object.assign(
      classes.Schema.classRef?.methods ?? {},
      CosmSchemaValue.bootClassMethods(),
    );
    Object.assign(
      classes.Prompt.classRef?.methods ?? {},
      CosmPromptValue.bootClassMethods(),
    );
    Object.assign(
      classes.Session.classRef?.methods ?? {},
      CosmSessionValue.bootClassMethods(),
    );
  }

  private static createCoreGlobals(classes: Record<string, CosmClass>): Record<string, CosmValue> {
    return {
      Class: classes.Class,
      Object: classes.Object,
      Number: classes.Number,
      Boolean: classes.Boolean,
      String: classes.String,
      Symbol: classes.Symbol,
      Array: classes.Array,
      Hash: classes.Hash,
      Function: classes.Function,
      Method: classes.Method,
      Namespace: classes.Namespace,
      Module: classes.Module,
      Process: classes.Process,
      Time: classes.Time,
      Random: classes.Random,
      Mirror: classes.Mirror,
      Error: classes.Error,
      Schema: classes.Schema,
      Prompt: classes.Prompt,
      Ai: classes.Ai,
      Session: classes.Session,
      DataModel: classes.DataModel,
      Http: classes.Http,
      HttpRequest: classes.HttpRequest,
      HttpResponse: classes.HttpResponse,
      HttpServer: classes.HttpServer,
      HttpRouter: classes.HttpRouter,
      Cosm: Construct.module("Cosm", {}, classes.Module),
      Agent: Construct.module("Agent", {}, classes.Module),
      Support: Construct.module("Support", {}, classes.Module),
      App: Construct.module("App", {}, classes.Module),
      Spec: Construct.module("Spec", {}, classes.Module),
      Test: Construct.module("Test", {}, classes.Module),
    };
  }

  private static installKernelGlobals(
    globals: Record<string, CosmValue>,
    classes: Record<string, CosmClass>,
    modules: Record<string, CosmObject>,
    runtime: BootstrapRuntime,
  ): void {
    const kernelMethods = classes.Kernel.methods;
    const kernelObject = Construct.kernel({}, classes.Kernel);
    const processObject = new CosmProcessValue({}, classes.Process);
    const timeObject = new CosmTimeValue({}, classes.Time);
    const randomObject = new CosmRandomValue({}, classes.Random);
    const aiObject = new CosmAiValue({}, classes.Ai, classes.Error);
    const sessionClass = classes.Session;
    const httpObject = new CosmHttpValue(
      {},
      classes.Http,
      classes.HttpServer,
      classes.Namespace,
      classes.HttpRequest,
      classes.HttpResponse,
    );

    globals.Kernel = kernelObject;
    globals.Process = processObject;
    globals.Time = timeObject;
    globals.Random = randomObject;
    globals.ai = aiObject;
    globals.Data = modules["cosm/data"];
    globals.Session = sessionClass;
    globals.http = httpObject;
    globals.assert = kernelMethods.assert;
    globals.print = kernelMethods.print;
    globals.puts = kernelMethods.puts;
    globals.warn = kernelMethods.warn;
    globals.test = kernelMethods.test;
    globals.expectEqual = kernelMethods.expectEqual;
    globals.resetTests = kernelMethods.resetTests;
    globals.testSummary = kernelMethods.testSummary;
    this.installConstantRootFields(globals, modules);
    globals.require = this.createRequireFunction(globals, modules, classes, runtime);
  }

  private static createCoreModules(classes: Record<string, CosmClass>): Record<string, CosmObject> {
    const testModule = Construct.module("cosm/test", {
      test: classes.Kernel.methods.test,
      describe: classes.Kernel.methods.describe,
      expectEqual: classes.Kernel.methods.expectEqual,
      reset: classes.Kernel.methods.resetTests,
      summary: classes.Kernel.methods.testSummary,
      resetTests: classes.Kernel.methods.resetTests,
      testSummary: classes.Kernel.methods.testSummary,
    }, classes.Module);

    const dataModule = Construct.module("cosm/data", {
      Model: classes.DataModel,
      string: RuntimeDispatch.reflectClassMethod(classes.Schema, Construct.symbol("string"), { classes, globals: {} }),
      number: RuntimeDispatch.reflectClassMethod(classes.Schema, Construct.symbol("number"), { classes, globals: {} }),
      boolean: RuntimeDispatch.reflectClassMethod(classes.Schema, Construct.symbol("boolean"), { classes, globals: {} }),
      enum: RuntimeDispatch.reflectClassMethod(classes.Schema, Construct.symbol("enum"), { classes, globals: {} }),
      array: Construct.nativeFunc("array", (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: Data.array expects 1 arguments, got ${args.length}`);
        }
        return new CosmSchemaValue("array", { item: this.expectDataSchema(args[0], classes.Error) }, classes.Schema, classes.Error);
      }),
      optional: Construct.nativeFunc("optional", (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: Data.optional expects 1 arguments, got ${args.length}`);
        }
        return new CosmSchemaValue("optional", { inner: this.expectDataSchema(args[0], classes.Error) }, classes.Schema, classes.Error);
      }),
      object: Construct.nativeFunc("object", (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: Data.object expects 1 arguments, got ${args.length}`);
        }
        return new CosmSchemaValue("object", { fields: new CosmNamespaceValue(this.expectDataFields(args[0], classes.Error), classes.Namespace) }, classes.Schema, classes.Error);
      }),
      model: Construct.nativeFunc("model", (args) => {
        if (args.length !== 2) {
          throw new Error(`Arity error: Data.model expects 2 arguments, got ${args.length}`);
        }
        const [name, fields] = args;
        if (name.type !== "string") {
          throw new Error("Type error: Data.model expects a string model name");
        }
        return new CosmDataModelValue(
          name.value,
          this.expectDataFields(fields, classes.Error),
          classes.DataModel,
          classes.Schema,
          classes.Error,
          classes.Namespace,
        );
      }),
    }, classes.Module);

    return {
      "cosm/test": testModule,
      "cosm/data": dataModule,
      "cosm/data.cosm": dataModule,
    };
  }

  private static expectDataSchema(value: CosmValue, errorClass?: CosmClassValue): CosmSchemaValue {
    if (value instanceof CosmSchemaValue) {
      return value;
    }
    if (value instanceof CosmDataModelValue) {
      return value.toSchema();
    }
    CosmErrorValue.raise(
      Construct.string("Type error: Data expects a Schema or Data model"),
      errorClass,
    );
  }

  private static expectDataFields(value: CosmValue, errorClass?: CosmClassValue): Record<string, CosmSchemaValue> {
    const entries = value.type === "hash"
      ? value.entries
      : value.type === "object"
        ? value.fields
        : undefined;
    if (!entries) {
      CosmErrorValue.raise(
        Construct.string("Type error: Data.model expects a hash, namespace, or object of field definitions"),
        errorClass,
      );
    }
    return Object.fromEntries(
      Object.entries(entries).map(([key, entry]) => [key, this.expectDataSchema(entry, errorClass)]),
    );
  }

  private static createRequireFunction(
    globals: Record<string, CosmValue>,
    modules: Record<string, CosmObject>,
    classes: Record<string, CosmClass>,
    runtime: BootstrapRuntime,
  ): CosmFunction {
    return Construct.nativeFunc('require', (args, _selfValue, env) => {
      if (args.length !== 1) {
        throw new Error(`Arity error: require expects 1 arguments, got ${args.length}`);
      }
      if (!env) {
        throw new Error('Require runtime error: missing environment');
      }
      const [target] = args;
      if (target.type !== 'string') {
        throw new Error('Type error: require expects a string argument');
      }
      const moduleName = this.resolveModuleName(target.value, modules, runtime, env);
      const loadedModule = modules[moduleName];
        if (loadedModule instanceof CosmModuleValue) {
          this.installModuleConstant(globals, classes, moduleName, loadedModule);
        if (moduleName === "cosm/test" || moduleName === "cosm/test.cosm") {
          env.bindings.test = loadedModule.fields.test;
          env.bindings.describe = loadedModule.fields.describe;
          env.bindings.expectEqual = loadedModule.fields.expectEqual;
          env.bindings.resetTests = loadedModule.fields.resetTests;
          env.bindings.testSummary = loadedModule.fields.testSummary;
        }
        if (moduleName === "cosm/spec" || moduleName === "cosm/spec.cosm") {
          env.bindings.suite = loadedModule.fields.suite;
          env.bindings.it = loadedModule.fields.it;
          env.bindings.assert = loadedModule.fields.assert;
          env.bindings.refute = loadedModule.fields.refute;
          env.bindings.assert_equal = loadedModule.fields.assert_equal;
          env.bindings.expect_raises = loadedModule.fields.expect_raises;
          env.bindings.finish = loadedModule.fields.finish;
        }
        return loadedModule;
      }
      const dynamicModule = runtime.loadModule(moduleName, env);
      if (dynamicModule) {
        modules[moduleName] = dynamicModule;
        modules[moduleName.replace(/\.(cosm|ecosm)$/u, '')] = dynamicModule;
        this.installModuleConstant(globals, classes, moduleName, dynamicModule);
        return dynamicModule;
      }
      throw new Error(`Require error: unknown module '${target.value}'`);
    });
  }

  private static installConstantRootFields(globals: Record<string, CosmValue>, modules: Record<string, CosmObject>): void {
    const cosmRoot = globals.Cosm as CosmModuleValue;
    cosmRoot.fields.Kernel = globals.Kernel;
    cosmRoot.fields.Process = globals.Process;
    cosmRoot.fields.Time = globals.Time;
    cosmRoot.fields.Random = globals.Random;
    cosmRoot.fields.Mirror = globals.Mirror;
    cosmRoot.fields.Error = globals.Error;
    cosmRoot.fields.Schema = globals.Schema;
    cosmRoot.fields.Prompt = globals.Prompt;
    cosmRoot.fields.Session = globals.Session;
    cosmRoot.fields.Http = globals.http;
    cosmRoot.fields.Data = modules["cosm/data"];
  }

  private static resolveModuleName(
    requestedName: string,
    modules: Record<string, CosmObject>,
    runtime: BootstrapRuntime,
    env: CosmEnv,
  ): string {
    const candidates = [requestedName];
    if (!/\.(cosm|ecosm)$/u.test(requestedName)) {
      candidates.push(`${requestedName}.cosm`, `${requestedName}.ecosm`);
    }
    for (const candidate of candidates) {
      if (modules[candidate] instanceof CosmModuleValue) {
        return candidate;
      }
      const dynamicModule = runtime.loadModule(candidate, env);
      if (dynamicModule) {
        modules[candidate] = dynamicModule;
        modules[candidate.replace(/\.(cosm|ecosm)$/u, '')] = dynamicModule;
        return candidate;
      }
    }
    return requestedName;
  }

  private static installModuleConstant(
    globals: Record<string, CosmValue>,
    classes: Record<string, CosmClass>,
    moduleName: string,
    moduleValue: CosmObject,
  ): void {
    if (!(moduleValue instanceof CosmModuleValue)) {
      return;
    }
    const path = this.moduleConstantPath(moduleName);
    if (path.length === 0) {
      return;
    }
    const [rootName, ...rest] = path;
    let current = globals[rootName];
    if (!(current instanceof CosmModuleValue)) {
      current = Construct.module(rootName, {}, classes.Module);
      globals[rootName] = current;
    }
    if (rest.length === 0) {
      Object.assign(current.fields, moduleValue.fields);
      return;
    }
    for (let index = 0; index < rest.length - 1; index += 1) {
      const segment = rest[index];
      const existing = current.fields[segment];
      if (existing instanceof CosmModuleValue) {
        current = existing;
        continue;
      }
      const next = Construct.module(`${current.moduleName}::${segment}`, {}, classes.Module);
      current.fields[segment] = next;
      current = next;
    }
    current.fields[rest.at(-1) as string] = moduleValue;
  }

  private static moduleConstantPath(moduleName: string): string[] {
    const normalized = moduleName.replace(/\\/g, "/").replace(/\.(cosm|ecosm)$/u, "");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length === 0) {
      return [];
    }
    const logicalParts = parts[0] === "lib" ? parts.slice(1) : parts;
    const mapped = logicalParts.map((part) => this.constantSegment(part));
    if (mapped.length === 2 && mapped[0] === mapped[1]) {
      return [mapped[0]];
    }
    if (mapped.at(-1) === "Index") {
      return mapped.slice(0, -1);
    }
    return mapped;
  }

  private static constantSegment(segment: string): string {
    const lower = segment.toLowerCase();
    if (lower === "ai") return "AI";
    if (lower === "http") return "HTTP";
    if (lower === "dm") return "DM";
    return segment
      .split("_")
      .filter(Boolean)
      .map((part) => {
        const key = part.toLowerCase();
        if (key === "ai") return "AI";
        if (key === "http") return "HTTP";
        if (key === "dm") return "DM";
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join("");
  }

  private static createBootClass(name: string, superclass: CosmClass, classClass: CosmClass): CosmClass {
    const classValue = Construct.class(name, superclass.name, [], {}, {}, superclass);
    classValue.classRef = this.createMetaclass(name, superclass.classRef ?? classClass, {}, classClass);
    return classValue;
  }

  static createMetaclass(name: string, superclassMeta: CosmClass, methods: Record<string, CosmFunction>, classClass: CosmClass): CosmClass {
    return Construct.class(`${name} class`, superclassMeta.name, [], methods, {}, superclassMeta, classClass);
  }

  static setCurrentRepository(repository: RuntimeRepository): void {
    this.currentRepository = repository;
  }
}
