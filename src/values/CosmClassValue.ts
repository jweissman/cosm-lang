import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
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
      methods: (self) => new CosmNamespaceValue(self.methods, self.classRef),
      classMethods: (self) => {
        const classMethodOwner = self.classRef && self.classRef !== self ? self.classRef : undefined;
        return new CosmNamespaceValue(classMethodOwner?.methods ?? self.classMethods, self.classRef);
      },
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

  lookupInstanceMethod(name: string): CosmFunctionValue | undefined {
    const method = this.methods[name];
    if (method) {
      return method;
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
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmClassValue.manifest);
  }
}
