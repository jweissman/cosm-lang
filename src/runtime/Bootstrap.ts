import { CosmClass, CosmFunction } from "../types";
import { createCoreClasses, createMetaclass } from "./bootstrap/classes";
import { installLoadedModuleConstant, createCoreGlobals, createCoreModules, installKernelGlobals } from "./bootstrap/globals";
import { installRuntimeHooks } from "./bootstrap/hooks";
import { installBootNativeMethods } from "./bootstrap/native_methods";
import { BootstrapRuntime, RuntimeRepository } from "./bootstrap/types";

export class Bootstrap {
  static createRepository(runtime: BootstrapRuntime): RuntimeRepository {
    installRuntimeHooks(runtime, () => this.currentRepository);

    const classes = createCoreClasses();
    installBootNativeMethods(classes);

    const globals = createCoreGlobals(classes);
    const modules = createCoreModules(classes);
    installKernelGlobals(globals, classes, modules, runtime);

    return { globals, classes, modules };
  }

  private static currentRepository?: RuntimeRepository;

  static createMetaclass(name: string, superclassMeta: CosmClass, methods: Record<string, CosmFunction>, classClass: CosmClass): CosmClass {
    return createMetaclass(name, superclassMeta, methods, classClass);
  }

  static setCurrentRepository(repository: RuntimeRepository): void {
    this.currentRepository = repository;
  }

  static installLoadedModuleConstant(repository: RuntimeRepository, moduleName: string): void {
    installLoadedModuleConstant(repository, moduleName);
  }
}
