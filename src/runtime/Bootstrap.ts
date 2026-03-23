import { Construct } from "../Construct";
import { CosmClass, CosmEnv, CosmFunction, CosmObject, CosmValue } from "../types";
import { manifestClassMethods, manifestMethods } from "./RuntimeManifest";
import { CosmClassValue } from "../values/CosmClassValue";
import { CosmFunctionValue } from "../values/CosmFunctionValue";
import { CosmKernelValue } from "../values/CosmKernelValue";
import { CosmMethodValue } from "../values/CosmMethodValue";
import { CosmModuleValue } from "../values/CosmModuleValue";
import { CosmNamespaceValue } from "../values/CosmNamespaceValue";
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
import { RuntimeDispatch } from "./RuntimeDispatch";
import { RuntimeEquality } from "./RuntimeEquality";
import { basename } from "node:path";

export type RuntimeRepository = {
  globals: Record<string, CosmValue>;
  classes: Record<string, CosmClass>;
  modules: Record<string, CosmObject>;
};

type BootstrapRuntime = {
  invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  instantiateClass: (classValue: CosmClass, args: CosmValue[]) => CosmObject;
  invokeSend: (receiver: CosmValue, messageValue: CosmValue, args: CosmValue[]) => CosmValue;
  classOf: (value: CosmValue) => CosmClass;
  internSymbol: (name: string) => CosmValue;
  loadModule: (name: string, env: CosmEnv) => CosmObject | undefined;
  evalSource: (source: string) => CosmValue;
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
    CosmKernelValue.installRuntimeHooks({
      send: (receiver, messageValue, args) => runtime.invokeSend(receiver, messageValue, args),
      invoke: (callee, args, selfValue, env) => runtime.invokeFunction(callee, args, selfValue, env),
      eval: (source) => runtime.evalSource(source),
    });
    CosmProcessValue.installRuntimeHooks({});
    CosmFunctionValue.installRuntimeHooks({
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
    });
    CosmMethodValue.installRuntimeHooks({
      invoke: (callee, args, selfValue) => runtime.invokeFunction(callee, args, selfValue),
    });
    CosmSymbolValue.installRuntimeHooks({
      intern: (name) => runtime.internSymbol(name),
    });
    CosmValueBase.installRuntimeHooks({
      send: (receiver, messageValue, args) => runtime.invokeSend(receiver, messageValue, args),
      lookupMethod: (receiver, message) => RuntimeDispatch.reflectMethod(receiver, message, this.currentRepository!),
      classOf: (receiver) => runtime.classOf(receiver),
      equal: (left, right) => RuntimeEquality.compare(left, right),
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

    for (const name of ['Number', 'Boolean', 'String', 'Symbol', 'Array', 'Hash', 'Function', 'Method', 'Namespace', 'Module', 'Kernel', 'Process', 'Time', 'Random', 'Mirror', 'Http', 'HttpRequest', 'HttpResponse', 'HttpServer', 'HttpRouter']) {
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
      Http: classes.Http,
      HttpRequest: classes.HttpRequest,
      HttpResponse: classes.HttpResponse,
      HttpServer: classes.HttpServer,
      HttpRouter: classes.HttpRouter,
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
    globals.http = httpObject;
    globals.assert = kernelMethods.assert;
    globals.print = kernelMethods.print;
    globals.puts = kernelMethods.puts;
    globals.warn = kernelMethods.warn;
    globals.test = kernelMethods.test;
    globals.expectEqual = kernelMethods.expectEqual;
    globals.resetTests = kernelMethods.resetTests;
    globals.testSummary = kernelMethods.testSummary;
    globals.require = this.createRequireFunction(modules, runtime);
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

    return {
      "cosm/test": testModule,
    };
  }

  private static createRequireFunction(modules: Record<string, CosmObject>, runtime: BootstrapRuntime): CosmFunction {
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
      const loadedModule = modules[target.value];
      if (loadedModule instanceof CosmModuleValue) {
        if (target.value === 'cosm/test') {
          env.bindings.test = loadedModule.fields.test;
          env.bindings.describe = loadedModule.fields.describe;
          env.bindings.expectEqual = loadedModule.fields.expectEqual;
          env.bindings.resetTests = loadedModule.fields.resetTests;
          env.bindings.testSummary = loadedModule.fields.testSummary;
        } else {
          env.bindings[this.moduleBindingName(target.value)] = loadedModule;
        }
        return loadedModule;
      }
      const dynamicModule = runtime.loadModule(target.value, env);
      if (dynamicModule) {
        modules[target.value] = dynamicModule;
        env.bindings[this.moduleBindingName(target.value)] = dynamicModule;
        return dynamicModule;
      }
      throw new Error(`Require error: unknown module '${target.value}'`);
    });
  }

  private static moduleBindingName(moduleName: string): string {
    return basename(moduleName, '.cosm').replace(/[^A-Za-z0-9_]/g, '_');
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
