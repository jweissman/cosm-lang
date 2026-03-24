import { CosmEnv, CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmStringValue } from "./CosmStringValue";
import { RuntimeInspect } from "../runtime/RuntimeInspect";


export abstract class CosmValueBase {
  private static sendHandler?: (receiver: CosmValue, message: CosmValue, args: CosmValue[], env?: CosmEnv) => CosmValue;
  private static methodLookupHandler?: (receiver: CosmValue, message: CosmValue) => CosmValue;
  private static methodsLookupHandler?: (receiver: CosmValue) => CosmValue;
  private static classOfHandler?: (receiver: CosmValue) => CosmValue;
  private static equalityHandler?: (left: CosmValue, right: CosmValue) => boolean;

  static installRuntimeHooks(hooks: {
    send: (receiver: CosmValue, message: CosmValue, args: CosmValue[], env?: CosmEnv) => CosmValue;
    lookupMethod: (receiver: CosmValue, message: CosmValue) => CosmValue;
    lookupMethods: (receiver: CosmValue) => CosmValue;
    classOf: (receiver: CosmValue) => CosmValue;
    equal: (left: CosmValue, right: CosmValue) => boolean;
  }): void {
    this.sendHandler = hooks.send;
    this.methodLookupHandler = hooks.lookupMethod;
    this.methodsLookupHandler = hooks.lookupMethods;
    this.classOfHandler = hooks.classOf;
    this.equalityHandler = hooks.equal;
  }

  abstract readonly type: string;

  static readonly manifest: RuntimeValueManifest<CosmValue> = {
    properties: {
      class: (self) => {
        if (!CosmValueBase.classOfHandler) {
          throw new Error('Value runtime error: class lookup handler is not installed');
        }
        return CosmValueBase.classOfHandler(self);
      },
    },
    methods: {
      eq: () => new CosmFunctionValue('eq', (args, selfValue) => {
        if (!selfValue) {
          throw new Error('Type error: eq expects a receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method eq expects 1 arguments, got ${args.length}`);
        }
        if (!CosmValueBase.equalityHandler) {
          throw new Error('Value runtime error: equality handler is not installed');
        }
        return new CosmBoolValue(CosmValueBase.equalityHandler(selfValue, args[0]));
      }),
      method: () => new CosmFunctionValue('method', (args, selfValue) => {
        if (!selfValue) {
          throw new Error('Type error: method expects a receiver');
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: method expects 1 arguments, got ${args.length}`);
        }
        if (!CosmValueBase.methodLookupHandler) {
          throw new Error('Value runtime error: method lookup handler is not installed');
        }
        return CosmValueBase.methodLookupHandler(selfValue, args[0]);
      }),
      methods: () => new CosmFunctionValue('methods', (args, selfValue) => {
        if (!selfValue) {
          throw new Error('Type error: methods expects a receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: methods expects 0 arguments, got ${args.length}`);
        }
        if (!CosmValueBase.methodsLookupHandler) {
          throw new Error('Value runtime error: methods lookup handler is not installed');
        }
        return CosmValueBase.methodsLookupHandler(selfValue);
      }),
      send: () => new CosmFunctionValue('send', (args, selfValue, env) => {
        if (!selfValue) {
          throw new Error('Type error: send expects a receiver');
        }
        if (args.length < 1) {
          throw new Error(`Arity error: method send expects at least 1 arguments, got ${args.length}`);
        }
        if (!CosmValueBase.sendHandler) {
          throw new Error('Value runtime error: send handler is not installed');
        }
        const [messageValue, ...messageArgs] = args;
        return CosmValueBase.sendHandler(selfValue, messageValue, messageArgs, env);
      }),
      inspect: () => new CosmFunctionValue('inspect', (args, selfValue) => {
        if (!selfValue) {
          throw new Error('Type error: inspect expects a receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(RuntimeInspect.format(selfValue));
      }),
      to_s: () => new CosmFunctionValue('to_s', (args, selfValue) => {
        if (!selfValue) {
          throw new Error('Type error: to_s expects a receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method to_s expects 0 arguments, got ${args.length}`);
        }
        try {
          return new CosmStringValue(selfValue.toCosmString('concatenate'));
        } catch {
          return new CosmStringValue(RuntimeInspect.format(selfValue));
        }
      }),
    },
  };

  plus(_right: CosmValue): CosmValue {
    throw new Error('Type error: add expects numeric operands or string concatenation');
  }

  nativeProperty(name: string): CosmValue | undefined {
    return manifestProperty(this as unknown as CosmValue, name, CosmValueBase.manifest);
  }

  nativeMethod(name: string): CosmFunctionValue | undefined {
    return manifestMethod(this as unknown as CosmValue, name, CosmValueBase.manifest);
  }

  visibleNativeMethodNames(): string[] {
    return [];
  }

  toCosmString(context: 'concatenate' | 'interpolate'): string {
    if (context === 'interpolate') {
      throw new Error(`Type error: cannot interpolate value of type ${this.type} into a string`);
    }
    throw new Error(`Type error: cannot concatenate value of type ${this.type} into a string`);
  }
}
