import { execFileSync } from "node:child_process";
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
import { CosmErrorValue } from "./CosmErrorValue";

export class CosmHttpValue extends CosmObjectValue {
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  private static methodLookupHandler?: (receiver: CosmValue, message: CosmValue) => CosmValue;
  private static requestHandler?: (method: string, url: string, options: { headers: Record<string, string>; body?: string }) => { status: number; body: string };

  static installRuntimeHooks(hooks: {
    invoke: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
    lookupMethod: (receiver: CosmValue, message: CosmValue) => CosmValue;
    request?: (method: string, url: string, options: { headers: Record<string, string>; body?: string }) => { status: number; body: string };
  }): void {
    this.invokeHandler = hooks.invoke;
    this.methodLookupHandler = hooks.lookupMethod;
    if ("request" in hooks) {
      this.requestHandler = hooks.request;
    }
  }

  static currentRuntimeHooks(): {
    invoke?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
    lookupMethod?: (receiver: CosmValue, message: CosmValue) => CosmValue;
    request?: (method: string, url: string, options: { headers: Record<string, string>; body?: string }) => { status: number; body: string };
  } {
    return {
      invoke: this.invokeHandler,
      lookupMethod: this.methodLookupHandler,
      request: this.requestHandler,
    };
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
      request: () => new CosmFunctionValue('request', (args, selfValue) => {
        if (!(selfValue instanceof CosmHttpValue)) {
          throw new Error('Type error: request expects an Http receiver');
        }
        if (args.length < 2 || args.length > 3) {
          throw new Error(`Arity error: request expects 2 or 3 arguments, got ${args.length}`);
        }
        const [methodValue, urlValue, optionsValue] = args;
        if (!(methodValue instanceof CosmStringValue)) {
          throw new Error("Type error: request expects a string method");
        }
        if (!(urlValue instanceof CosmStringValue)) {
          throw new Error("Type error: request expects a string url");
        }
        const request = selfValue.parseRequestOptions(optionsValue);
        const response = selfValue.performRequest(methodValue.value, urlValue.value, request);
        return new CosmNamespaceValue({
          status: Construct.number(response.status),
          ok: Construct.bool(response.status >= 200 && response.status < 300),
          body: Construct.string(response.body),
        }, selfValue.namespaceClassRef);
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

  private parseRequestOptions(value: CosmValue | undefined): {
    headers: Record<string, string>;
    body?: string;
  } {
    if (value === undefined || value.type === "bool") {
      return { headers: {} };
    }
    if (!(value instanceof CosmNamespaceValue) && !(value instanceof CosmHashValue)) {
      throw new Error("Type error: request options must be a Namespace, Hash, or false");
    }
    const fields = value instanceof CosmNamespaceValue ? value.fields : value.entries;
    const headersValue = fields.headers;
    const bodyValue = fields.body;
    const headers = this.renderHeaders(headersValue);
    const body = bodyValue === undefined || bodyValue.type === "bool"
      ? undefined
      : this.renderBody(bodyValue);
    return {
      headers: headers ? Object.fromEntries(Object.entries(headers)) : {},
      body,
    };
  }

  private performRequest(method: string, url: string, options: { headers: Record<string, string>; body?: string }): {
    status: number;
    body: string;
  } {
    if (CosmHttpValue.requestHandler) {
      return CosmHttpValue.requestHandler(method, url, options);
    }
    const args = [
      "-sS",
      "-X",
      method,
      "-w",
      "\n__COSM_HTTP_STATUS__:%{http_code}",
    ];
    for (const [key, value] of Object.entries(options.headers)) {
      args.push("-H", `${key}: ${value}`);
    }
    if (options.body !== undefined) {
      args.push("-d", options.body);
    }
    args.push(url);
    const raw = execFileSync("curl", args, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const marker = "\n__COSM_HTTP_STATUS__:";
    const markerIndex = raw.lastIndexOf(marker);
    if (markerIndex === -1) {
      throw new Error("Http runtime error: request did not return a status marker");
    }
    const body = raw.slice(0, markerIndex);
    const statusText = raw.slice(markerIndex + marker.length).trim();
    const status = Number.parseInt(statusText, 10);
    if (!Number.isInteger(status)) {
      throw new Error(`Http runtime error: request returned an invalid status code ${JSON.stringify(statusText)}`);
    }
    return { status, body };
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
              return new Response(this.renderServerError(error), {
                status: 500,
                headers: { "content-type": "text/plain; charset=utf-8" },
              });
            }
          },
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Http runtime error: failed to start server');
  }

  private renderServerError(error: unknown): string {
    return CosmErrorValue.fromUnknown(error, this.responseClassRef?.classRef).toDisplayString();
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
