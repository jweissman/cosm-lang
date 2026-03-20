import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmFunctionValue } from "./CosmFunctionValue";


export abstract class CosmValueBase {
  private static sendHandler?: (receiver: CosmValue, message: CosmValue, args: CosmValue[]) => CosmValue;
  private static methodLookupHandler?: (receiver: CosmValue, message: CosmValue) => CosmValue;
  private static classOfHandler?: (receiver: CosmValue) => CosmValue;
  private static equalityHandler?: (left: CosmValue, right: CosmValue) => boolean;

  static installRuntimeHooks(hooks: {
    send: (receiver: CosmValue, message: CosmValue, args: CosmValue[]) => CosmValue;
    lookupMethod: (receiver: CosmValue, message: CosmValue) => CosmValue;
    classOf: (receiver: CosmValue) => CosmValue;
    equal: (left: CosmValue, right: CosmValue) => boolean;
  }): void {
    this.sendHandler = hooks.send;
    this.methodLookupHandler = hooks.lookupMethod;
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
      send: () => new CosmFunctionValue('send', (args, selfValue) => {
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
        return CosmValueBase.sendHandler(selfValue, messageValue, messageArgs);
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

  toCosmString(context: 'concatenate' | 'interpolate'): string {
    if (context === 'interpolate') {
      throw new Error(`Type error: cannot interpolate value of type ${this.type} into a string`);
    }
    throw new Error(`Type error: cannot concatenate value of type ${this.type} into a string`);
  }
}
