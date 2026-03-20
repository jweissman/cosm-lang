import { ValueAdapter } from "../ValueAdapter";
import { RuntimeValueManifest, manifestClassMethods, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";

export class CosmHttpResponseValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmHttpResponseValue> = {
    properties: {
      status: (self) => new CosmNumberValue(self.status),
      body: (self) => self.body,
      headers: (self) => self.headers,
    },
    classMethods: {
      ok: () => new CosmFunctionValue('ok', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: HttpResponse.ok expects 1 arguments, got ${args.length}`);
        }
        return new CosmHttpResponseValue(200, args[0], new CosmNamespaceValue({}));
      }),
      text: () => new CosmFunctionValue('text', (args) => {
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: HttpResponse.text expects 1 or 2 arguments, got ${args.length}`);
        }
        const [body, status] = args;
        const statusCode = status ? this.expectStatus(status, 'HttpResponse.text') : 200;
        return new CosmHttpResponseValue(statusCode, body, new CosmNamespaceValue({}));
      }),
      json: () => new CosmFunctionValue('json', (args) => {
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: HttpResponse.json expects 1 or 2 arguments, got ${args.length}`);
        }
        const [value, status] = args;
        const statusCode = status ? this.expectStatus(status, 'HttpResponse.json') : 200;
        return new CosmHttpResponseValue(
          statusCode,
          new CosmStringValue(JSON.stringify(ValueAdapter.cosmToJS(value))),
          new CosmNamespaceValue({ "content-type": new CosmStringValue("application/json") }),
        );
      }),
    },
  };

  static bootClassMethods(): Record<string, CosmFunctionValue> {
    return manifestClassMethods(CosmHttpResponseValue.manifest);
  }

  constructor(
    public readonly status: number,
    public readonly body: CosmValue,
    public readonly headers: CosmNamespaceValue,
    classRef?: CosmClassValue,
  ) {
    super('HttpResponse', {}, classRef);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmHttpResponseValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmHttpResponseValue.manifest);
  }

  private static expectStatus(value: CosmValue, context: string): number {
    if (value.type !== 'number' || !Number.isInteger(value.value)) {
      throw new Error(`Type error: ${context} expects an integer status code`);
    }
    return value.value;
  }
}
