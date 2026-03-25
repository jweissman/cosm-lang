import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmModuleValue } from "./CosmModuleValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";
import { CosmNamespaceValue } from "./CosmNamespaceValue";


export class CosmClassValue extends CosmValueBase {
  private static instantiateHandler?: (classValue: CosmClassValue, args: CosmValue[]) => CosmValue;
  private static classMethodLookupHandler?: (classValue: CosmClassValue, message: CosmValue) => CosmValue;

  static installRuntimeHooks(hooks: {
    instantiate: (classValue: CosmClassValue, args: CosmValue[]) => CosmValue;
    lookupClassMethod: (classValue: CosmClassValue, message: CosmValue) => CosmValue;
  }): void {
    this.instantiateHandler = hooks.instantiate;
    this.classMethodLookupHandler = hooks.lookupClassMethod;
  }

  static readonly manifest: RuntimeValueManifest<CosmClassValue> = {
    properties: {
      name: (self) => new CosmStringValue(self.name),
      metaclass: (self) => self.classRef,
      superclass: (self) => self.superclass,
      slots: (self) => new CosmArrayValue(self.slots.map((slot) => new CosmStringValue(slot))),
      methods: (self) => new CosmNamespaceValue(self.visibleInstanceMethods(), self.classRef),
      classMethods: (self) => {
        const classMethodOwner = self.classRef && self.classRef !== self ? self.classRef : undefined;
        return new CosmNamespaceValue(classMethodOwner?.visibleInstanceMethods() ?? self.classMethods, self.classRef);
      },
      includedModules: (self) => new CosmArrayValue(self.includedModules.map((moduleValue) => moduleValue)),
    },
    methods: {
      new: () => new CosmFunctionValue('new', (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error('Type error: new expects a class receiver');
        }
        if (!CosmClassValue.instantiateHandler) {
          throw new Error('Class runtime error: instantiate handler is not installed');
        }
        return CosmClassValue.instantiateHandler(selfValue, args);
      }),
      classMethod: () => new CosmFunctionValue('classMethod', (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error('Type error: classMethod expects a class receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: classMethod expects 1 arguments, got ${args.length}`);
        }
        if (!CosmClassValue.classMethodLookupHandler) {
          throw new Error('Class runtime error: classMethod lookup handler is not installed');
        }
        return CosmClassValue.classMethodLookupHandler(selfValue, args[0]);
      }),
      include: () => new CosmFunctionValue('include', (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error('Type error: include expects a class receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: include expects 1 arguments, got ${args.length}`);
        }
        const [moduleValue] = args;
        if (!(moduleValue instanceof CosmModuleValue)) {
          throw new Error('Type error: include expects a Module');
        }
        selfValue.includeModule(moduleValue);
        return selfValue;
      }),
    },
  };

  readonly type = 'class';

  constructor(
    public readonly name: string,
    public readonly superclassName?: string,
    public readonly slots: string[] = [],
    public readonly methods: Record<string, CosmFunctionValue> = {},
    public readonly classMethods: Record<string, CosmFunctionValue> = {},
    public readonly superclass?: CosmClassValue,
    public classRef?: CosmClassValue
  ) {
    super();
  }

  readonly includedModules: CosmModuleValue[] = [];

  includeModule(moduleValue: CosmModuleValue): void {
    const existingIndex = this.includedModules.findIndex((candidate) => candidate.moduleName === moduleValue.moduleName);
    if (existingIndex >= 0) {
      this.includedModules.splice(existingIndex, 1);
    }
    this.includedModules.push(moduleValue);
  }

  visibleInstanceMethods(): Record<string, CosmFunctionValue> {
    const visible = this.superclass ? this.superclass.visibleInstanceMethods() : {};
    for (const moduleValue of this.includedModules) {
      Object.assign(visible, this.moduleFunctionEntries(moduleValue));
    }
    return {
      ...visible,
      ...this.methods,
    };
  }

  private lookupIncludedMethod(name: string): CosmFunctionValue | undefined {
    for (let index = this.includedModules.length - 1; index >= 0; index -= 1) {
      const candidate = this.moduleFunctionEntries(this.includedModules[index])[name];
      if (candidate) {
        return candidate;
      }
    }
    return undefined;
  }

  private moduleFunctionEntries(moduleValue: CosmModuleValue): Record<string, CosmFunctionValue> {
    return Object.fromEntries(
      Object.entries(moduleValue.fields).filter(([, value]) => value instanceof CosmFunctionValue),
    ) as Record<string, CosmFunctionValue>;
  }

  lookupInstanceMethod(name: string): CosmFunctionValue | undefined {
    const method = this.methods[name];
    if (method) {
      return method;
    }
    const includedMethod = this.lookupIncludedMethod(name);
    if (includedMethod) {
      return includedMethod;
    }
    return this.superclass?.lookupInstanceMethod(name);
  }

  lookupClassSideMethod(name: string): CosmFunctionValue | undefined {
    return this.classRef?.lookupInstanceMethod(name);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmClassValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    if (name === 'new') {
      const classSideNew = this.lookupClassSideMethod(name);
      if (classSideNew) {
        return classSideNew;
      }
    }
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmClassValue.manifest);
  }
}
