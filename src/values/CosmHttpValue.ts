import { Construct } from "../Construct";
import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmEnv, CosmValue } from "../types";
import { ValueAdapter } from "../ValueAdapter";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmHashValue } from "./CosmHashValue";
import { CosmHttpRequestValue } from "./CosmHttpRequestValue";
import { CosmHttpResponseValue } from "./CosmHttpResponseValue";
import { CosmHttpServerValue } from "./CosmHttpServerValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";

export class CosmHttpValue extends CosmObjectValue {
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  private static methodLookupHandler?: (receiver: CosmValue, message: CosmValue) => CosmValue;

  static installRuntimeHooks(hooks: {
    invoke: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
    lookupMethod: (receiver: CosmValue, message: CosmValue) => CosmValue;
  }): void {
    this.invokeHandler = hooks.invoke;
    this.methodLookupHandler = hooks.lookupMethod;
  }

  static readonly manifest: RuntimeValueManifest<CosmHttpValue> = {
    methods: {
      serve: () => new CosmFunctionValue('serve', (args, selfValue, env) => {
        if (!(selfValue instanceof CosmHttpValue)) {
          throw new Error('Type error: serve expects an Http receiver');
        }
        if (args.length !== 2) {
          throw new Error(`Arity error: serve expects 2 arguments, got ${args.length}`);
        }
        if (!CosmHttpValue.invokeHandler) {
          throw new Error('Http runtime error: invoke handler is not installed');
        }
        const [portValue, handler] = args;
        if (portValue.type !== 'number') {
          throw new Error('Type error: serve expects a numeric port argument');
        }
        const requestedPort = portValue.value;
        if (!Number.isInteger(requestedPort) || requestedPort < 0) {
          throw new Error('Type error: serve expects a non-negative integer port');
        }

        const resolvedHandler = selfValue.normalizeHandler(handler);
        const server = selfValue.startServer(requestedPort, resolvedHandler, env);

        const port = server.port;
        const url = `http://127.0.0.1:${port}`;
        return new CosmHttpServerValue(server, port, url, selfValue.serverClassRef);
      }),
    },
  };

  constructor(
    fields: Record<string, CosmValue>,
    classRef?: CosmClassValue,
    public readonly serverClassRef?: CosmClassValue,
    public readonly namespaceClassRef?: CosmClassValue,
    public readonly requestClassRef?: CosmClassValue,
    public readonly responseClassRef?: CosmClassValue,
  ) {
    super('Http', fields, classRef);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmHttpValue.manifest);
  }

  private responseFrom(value: CosmValue): Response {
    if (value instanceof CosmHttpResponseValue) {
      return new Response(this.renderBody(value.body), {
        status: value.status,
        headers: Object.fromEntries(
          Object.entries(value.headers.fields).map(([key, headerValue]) => [key, this.renderBody(headerValue)]),
        ),
      });
    }
    if (value instanceof CosmStringValue) {
      return new Response(value.value);
    }
    if (value instanceof CosmHashValue) {
      const statusValue = value.entries.status;
      const bodyValue = value.entries.body;
      const headersValue = value.entries.headers;
      const status = statusValue?.type === 'number' ? statusValue.value : 200;
      const body = bodyValue ? this.renderBody(bodyValue) : "";
      const headers = this.renderHeaders(headersValue);
      return new Response(body, { status, headers });
    }
    return new Response(this.renderBody(value));
  }

  private renderBody(value: CosmValue): string {
    if (value instanceof CosmStringValue) {
      return value.value;
    }
    try {
      return value.toCosmString('interpolate');
    } catch {
      return ValueAdapter.format(value);
    }
  }

  private renderHeaders(value: CosmValue | undefined): HeadersInit | undefined {
    if (value instanceof CosmNamespaceValue) {
      return Object.fromEntries(
        Object.entries(value.fields).map(([key, headerValue]) => [key, this.renderBody(headerValue)]),
      );
    }
    if (!(value instanceof CosmHashValue)) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(value.entries).map(([key, headerValue]) => [key, this.renderBody(headerValue)]),
    );
  }

  private startServer(port: number, handler: CosmValue, env?: CosmEnv): Bun.Server {
    const ports = port === 0
      ? Array.from({ length: 10 }, () => 20000 + Math.floor(Math.random() * 30000))
      : [port];

    let lastError: unknown;
    for (const candidatePort of ports) {
      try {
        return Bun.serve({
          hostname: '127.0.0.1',
          port: candidatePort,
          fetch: async (request) => {
            try {
              const requestUrl = new URL(request.url);
              const requestHeaders = new CosmNamespaceValue(
                Object.fromEntries(Array.from(request.headers.entries()).map(([key, headerValue]) => [
                  key,
                  Construct.string(headerValue),
                ])),
                this.namespaceClassRef,
              );
              const requestQuery = new CosmNamespaceValue(
                Object.fromEntries(Array.from(requestUrl.searchParams.entries()).map(([key, queryValue]) => [
                  key,
                  Construct.string(queryValue),
                ])),
                this.namespaceClassRef,
              );
              const requestBody = await request.text();
              const requestValue = new CosmHttpRequestValue(
                request.method,
                request.url,
                requestUrl.pathname,
                requestHeaders,
                requestQuery,
                requestBody,
                this.requestClassRef,
              );
              const result = CosmHttpValue.invokeHandler!(handler, [requestValue], undefined, env);
              return this.responseFrom(result);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              return new Response(message, { status: 500 });
            }
          },
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Http runtime error: failed to start server');
  }

  private normalizeHandler(handler: CosmValue): CosmValue {
    if (handler.type === 'function' || handler.type === 'method') {
      return handler;
    }
    if (handler.type !== 'object') {
      throw new Error('Type error: serve expects a function, method, or object with handle(req)');
    }
    if (!CosmHttpValue.methodLookupHandler) {
      throw new Error('Http runtime error: method lookup handler is not installed');
    }
    try {
      return CosmHttpValue.methodLookupHandler(handler, Construct.symbol('handle'));
    } catch (error) {
      if (
        error instanceof Error
        && (
          error.message.includes("has no property 'handle'")
          || error.message.includes("has no instance method 'handle'")
          || error.message.includes("property 'handle' is not a method")
        )
      ) {
        throw new Error('Type error: serve expects a function, method, or object with handle(req)');
      }
      throw error;
    }
  }
}
