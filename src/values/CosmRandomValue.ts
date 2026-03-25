import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmArrayValue } from "./CosmArrayValue";

export class CosmRandomValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmRandomValue> = {
    methods: {
      float: () => new CosmFunctionValue('float', (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: float expects 0 arguments, got ${args.length}`);
        }
        return new CosmNumberValue(Math.random());
      }),
      int: () => new CosmFunctionValue('int', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: int expects 1 arguments, got ${args.length}`);
        }
        const [max] = args;
        if (max.type !== 'number' || !Number.isInteger(max.value) || max.value <= 0) {
          throw new Error('Type error: int expects a positive integer max');
        }
        return new CosmNumberValue(Math.floor(Math.random() * max.value));
      }),
      choice: () => new CosmFunctionValue('choice', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: choice expects 1 arguments, got ${args.length}`);
        }
        const [items] = args;
        if (!(items instanceof CosmArrayValue)) {
          throw new Error('Type error: choice expects an array');
        }
        if (items.items.length === 0) {
          throw new Error('Type error: choice expects a non-empty array');
        }
        return items.items[Math.floor(Math.random() * items.items.length)];
      }),
    },
  };

  constructor(fields: Record<string, import("../types").CosmValue>, classRef?: CosmClassValue) {
    super('Random', fields, classRef);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmRandomValue.manifest);
  }
}
