import { Construct } from "../../Construct";
import { CosmClass, CosmEnv, CosmFunction, CosmObject, CosmValue } from "../../types";
import { CosmAiValue } from "../../values/CosmAiValue";
import { CosmDataModelValue } from "../../values/CosmDataModelValue";
import { CosmErrorValue } from "../../values/CosmErrorValue";
import { CosmModuleValue } from "../../values/CosmModuleValue";
import { CosmNamespaceValue } from "../../values/CosmNamespaceValue";
import { CosmProcessValue } from "../../values/CosmProcessValue";
import { CosmRandomValue } from "../../values/CosmRandomValue";
import { CosmSchemaValue } from "../../values/CosmSchemaValue";
import { CosmHttpValue } from "../../values/CosmHttpValue";
import { CosmTimeValue } from "../../values/CosmTimeValue";
import { RuntimeDispatch } from "../RuntimeDispatch";
import { BootGlobals, BootModules, BootstrapRuntime } from "./types";

export function createCoreGlobals(classes: Record<string, CosmClass>): Record<string, CosmValue> {
  return {
    Class: classes.Class,
    BasicObject: classes.BasicObject,
    Object: classes.Object,
    Number: classes.Number,
    Boolean: classes.Boolean,
    Nihil: classes.Nihil,
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
    HologramHandle: classes.HologramHandle,
    Error: classes.Error,
    Schema: classes.Schema,
    Prompt: classes.Prompt,
    Ai: classes.Ai,
    Session: classes.Session,
    DataModel: classes.DataModel,
    DataRecord: classes.DataRecord,
    EnumTag: classes.EnumTag,
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

export function createCoreModules(classes: Record<string, CosmClass>): Record<string, CosmObject> {
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
      return new CosmSchemaValue("array", { item: expectDataSchema(args[0], classes.Error) }, classes.Schema, classes.Error);
    }),
    optional: Construct.nativeFunc("optional", (args) => {
      if (args.length !== 1) {
        throw new Error(`Arity error: Data.optional expects 1 arguments, got ${args.length}`);
      }
      return new CosmSchemaValue("optional", { inner: expectDataSchema(args[0], classes.Error) }, classes.Schema, classes.Error);
    }),
    object: Construct.nativeFunc("object", (args) => {
      if (args.length !== 1) {
        throw new Error(`Arity error: Data.object expects 1 arguments, got ${args.length}`);
      }
      return new CosmSchemaValue("object", { fields: new CosmNamespaceValue(expectDataFields(args[0], classes.Error), classes.Namespace) }, classes.Schema, classes.Error);
    }),
    model: Construct.nativeFunc("model", (args) => {
      if (args.length < 2 || args.length > 3) {
        throw new Error(`Arity error: Data.model expects 2 or 3 arguments, got ${args.length}`);
      }
      const [name, fields, defaults = Construct.hash({})] = args;
      if (name.type !== "string") {
        throw new Error("Type error: Data.model expects a string model name");
      }
      return new CosmDataModelValue(
        name.value,
        expectDataFields(fields, classes.Error),
        classes.DataModel,
        classes.Schema,
        classes.Error,
        classes.Namespace,
        classes.DataRecord,
        classes.EnumTag,
        expectDataValueEntries(defaults, "Data.model defaults", classes.Error),
      );
    }),
  }, classes.Module);

  return {
    "cosm/test": testModule,
    "cosm/data": dataModule,
    "cosm/data.cosm": dataModule,
  };
}

export function installKernelGlobals(
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
  const aiObject = new CosmAiValue({}, classes.Ai, classes.Error, classes.EnumTag);
  const httpObject = new CosmHttpValue({}, classes.Http, classes.HttpServer, classes.Namespace, classes.HostObject, classes.HttpRequest, classes.HttpResponse);

  globals.Kernel = kernelObject;
  globals.Process = processObject;
  globals.Time = timeObject;
  globals.Random = randomObject;
  globals.nihil = Construct.nihil();
  globals.ai = aiObject;
  globals.Data = modules["cosm/data"];
  globals.Session = classes.Session;
  globals.http = httpObject;
  globals.assert = kernelMethods.assert;
  globals.print = kernelMethods.print;
  globals.puts = kernelMethods.puts;
  globals.warn = kernelMethods.warn;
  globals.test = kernelMethods.test;
  globals.expectEqual = kernelMethods.expectEqual;
  globals.resetTests = kernelMethods.resetTests;
  globals.testSummary = kernelMethods.testSummary;
  installConstantRootFields(globals, modules);
  globals.require = createRequireFunction(globals, modules, classes, runtime);
}

export function installLoadedModuleConstant(repository: { globals: BootGlobals; classes: Record<string, CosmClass>; modules: BootModules }, moduleName: string): void {
  const moduleValue = repository.modules[moduleName];
  if (moduleValue) {
    installModuleConstant(repository.globals, repository.classes, moduleName, moduleValue);
  }
}

function createRequireFunction(
  globals: Record<string, CosmValue>,
  modules: Record<string, CosmObject>,
  classes: Record<string, CosmClass>,
  runtime: BootstrapRuntime,
): CosmFunction {
  return Construct.nativeFunc("require", (args, _selfValue, env) => {
    if (args.length !== 1) {
      throw new Error(`Arity error: require expects 1 arguments, got ${args.length}`);
    }
    if (!env) {
      throw new Error("Require runtime error: missing environment");
    }
    const [target] = args;
    if (target.type !== "string") {
      throw new Error("Type error: require expects a string argument");
    }
    const moduleName = resolveModuleName(target.value, modules, runtime, env);
    const loadedModule = modules[moduleName];
    if (loadedModule instanceof CosmModuleValue) {
      installModuleConstant(globals, classes, moduleName, loadedModule);
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
        env.bindings.expect = loadedModule.fields.expect;
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
      modules[moduleName.replace(/\.(cosm|ecosm)$/u, "")] = dynamicModule;
      installModuleConstant(globals, classes, moduleName, dynamicModule);
      return dynamicModule;
    }
    throw new Error(`Require error: unknown module '${target.value}'`);
  });
}

function expectDataSchema(value: CosmValue, errorClass?: CosmClass): CosmSchemaValue {
  if (value instanceof CosmSchemaValue) {
    return value;
  }
  if (value instanceof CosmDataModelValue) {
    return value.toSchema();
  }
  CosmErrorValue.raise(Construct.string("Type error: Data expects a Schema or Data model"), errorClass);
}

function expectDataFields(value: CosmValue, errorClass?: CosmClass): Record<string, CosmSchemaValue> {
  const entries = expectDataValueEntries(value, "Data.model expects a hash, namespace, or object of field definitions", errorClass);
  return Object.fromEntries(
    Object.entries(entries).map(([key, entry]) => [key, expectDataSchema(entry, errorClass)]),
  );
}

function expectDataValueEntries(value: CosmValue, errorMessage: string, errorClass?: CosmClass): Record<string, CosmValue> {
  const entries = value.type === "hash"
    ? value.entries
    : value.type === "object"
      ? value.fields
      : undefined;
  if (!entries) {
    CosmErrorValue.raise(Construct.string(`Type error: ${errorMessage}`), errorClass);
  }
  return entries;
}

function installConstantRootFields(globals: Record<string, CosmValue>, modules: Record<string, CosmObject>): void {
  const cosmRoot = globals.Cosm as CosmModuleValue;
  cosmRoot.fields.BasicObject = globals.BasicObject;
  cosmRoot.fields.Object = globals.Object;
  cosmRoot.fields.Module = globals.Module;
  cosmRoot.fields.Class = globals.Class;
  cosmRoot.fields.Nihil = globals.Nihil;
  cosmRoot.fields.Kernel = globals.Kernel;
  cosmRoot.fields.Process = globals.Process;
  cosmRoot.fields.Time = globals.Time;
  cosmRoot.fields.Random = globals.Random;
  cosmRoot.fields.Mirror = globals.Mirror;
  cosmRoot.fields.HologramHandle = globals.HologramHandle;
  cosmRoot.fields.Error = globals.Error;
  cosmRoot.fields.Schema = globals.Schema;
  cosmRoot.fields.Prompt = globals.Prompt;
  cosmRoot.fields.Session = globals.Session;
  cosmRoot.fields.Http = globals.http;
  cosmRoot.fields.Data = modules["cosm/data"];
}

function resolveModuleName(
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
      modules[candidate.replace(/\.(cosm|ecosm)$/u, "")] = dynamicModule;
      return candidate;
    }
  }
  return requestedName;
}

function installModuleConstant(
  globals: Record<string, CosmValue>,
  classes: Record<string, CosmClass>,
  moduleName: string,
  moduleValue: CosmObject,
): void {
  if (!(moduleValue instanceof CosmModuleValue)) {
    return;
  }
  const path = moduleConstantPath(moduleName);
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

function moduleConstantPath(moduleName: string): string[] {
  const normalized = moduleName.replace(/\\/g, "/").replace(/\.(cosm|ecosm)$/u, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  const logicalParts = parts[0] === "lib" ? parts.slice(1) : parts;
  const mapped = logicalParts.map((part) => constantSegment(part));
  if (mapped.length === 2 && mapped[0] === mapped[1]) {
    return [mapped[0]];
  }
  if (mapped.at(-1) === "Index") {
    return mapped.slice(0, -1);
  }
  return mapped;
}

function constantSegment(segment: string): string {
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
