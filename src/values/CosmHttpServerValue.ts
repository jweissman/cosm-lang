import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmValue } from "../types";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";

export class CosmHttpServerValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmHttpServerValue> = {
    properties: {
      port: (self) => new CosmNumberValue(self.port),
      url: (self) => new CosmStringValue(self.url),
    },
    methods: {
      stop: () => new CosmFunctionValue('stop', (args, selfValue) => {
        if (!(selfValue instanceof CosmHttpServerValue)) {
          throw new Error('Type error: stop expects an HttpServer receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method stop expects 0 arguments, got ${args.length}`);
        }
        selfValue.server?.stop(true);
        return new CosmBoolValue(true);
      }),
    },
  };

  constructor(
    private readonly server?: Bun.Server,
    public readonly port: number = 0,
    public readonly url: string = "",
    classRef?: CosmClassValue,
  ) {
    super('HttpServer', {}, classRef);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmHttpServerValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmHttpServerValue.manifest);
  }
}
