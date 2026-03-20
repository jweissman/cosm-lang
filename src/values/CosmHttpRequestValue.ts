import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";

export class CosmHttpRequestValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmHttpRequestValue> = {
    properties: {
      method: (self) => new CosmStringValue(self.method),
      url: (self) => new CosmStringValue(self.url),
      path: (self) => new CosmStringValue(self.path),
      headers: (self) => self.headers,
      query: (self) => self.query,
    },
    methods: {
      bodyText: () => new CosmFunctionValue('bodyText', (args, selfValue) => {
        if (!(selfValue instanceof CosmHttpRequestValue)) {
          throw new Error('Type error: bodyText expects an HttpRequest receiver');
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: method bodyText expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(selfValue.bodyTextValue);
      }),
    },
  };

  constructor(
    public readonly method: string,
    public readonly url: string,
    public readonly path: string,
    public readonly headers: CosmNamespaceValue,
    public readonly query: CosmNamespaceValue,
    public readonly bodyTextValue: string,
    classRef?: CosmClassValue,
  ) {
    super('HttpRequest', {}, classRef);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmHttpRequestValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmHttpRequestValue.manifest);
  }
}
