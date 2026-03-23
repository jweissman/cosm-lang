import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmEnv, CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmHttpRequestValue } from "./CosmHttpRequestValue";
import { CosmHttpResponseValue } from "./CosmHttpResponseValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmSymbolValue } from "./CosmSymbolValue";
import { CosmStringValue } from "./CosmStringValue";

class CosmHttpRouterDslValue extends CosmObjectValue {
  static readonly runtimeClass = new CosmClassValue("HttpRouterDsl", "Object");

  constructor(
    private readonly router: CosmHttpRouterValue,
  ) {
    super("HttpRouterDsl", {}, CosmHttpRouterDslValue.runtimeClass);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    if (name !== "does_not_understand") {
      return undefined;
    }
    return new CosmFunctionValue("does_not_understand", (args, selfValue) => {
      if (!(selfValue instanceof CosmHttpRouterDslValue)) {
        throw new Error("Type error: does_not_understand expects an HttpRouterDsl receiver");
      }
      if (args.length !== 2) {
        throw new Error(`Arity error: does_not_understand expects 2 arguments, got ${args.length}`);
      }
      const [messageValue, routeArgsValue] = args;
      if (!(messageValue instanceof CosmSymbolValue)) {
        throw new Error("Type error: does_not_understand expects a symbol message");
      }
      if (routeArgsValue.type !== "array") {
        throw new Error("Type error: does_not_understand expects an array of arguments");
      }
      if (!["get", "post", "put", "delete"].includes(messageValue.name)) {
        throw new Error(`Property error: object of class HttpRouterDsl has no property '${messageValue.name}'`);
      }
      selfValue.router.registerDslRoute(messageValue.name.toUpperCase(), routeArgsValue.items, `draw.${messageValue.name}`);
      return selfValue.router;
    });
  }
}

export class CosmHttpRouterValue extends CosmObjectValue {
  private static invokeHandler?: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  private static methodLookupHandler?: (receiver: CosmValue, message: CosmValue) => CosmValue;

  static installRuntimeHooks(hooks: {
    invoke: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
    lookupMethod: (receiver: CosmValue, message: CosmValue) => CosmValue;
  }): void {
    this.invokeHandler = hooks.invoke;
    this.methodLookupHandler = hooks.lookupMethod;
  }

  static readonly manifest: RuntimeValueManifest<CosmHttpRouterValue> = {
    properties: {
      length: (self) => new CosmNumberValue(self.routes.size),
    },
    methods: {
      handle: () => new CosmFunctionValue("handle", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmHttpRouterValue)) {
          throw new Error("Type error: handle expects an HttpRouter receiver");
        }
        if (args.length === 1) {
          const [request] = args;
          if (!(request instanceof CosmHttpRequestValue)) {
            throw new Error("Type error: HttpRouter.handle(req) expects an HttpRequest");
          }
          return selfValue.dispatchRequest(request, env);
        }
        if (args.length === 3) {
          const [method, path, handler] = args;
          selfValue.registerRoute(method, path, handler);
          return selfValue;
        }
        throw new Error(`Arity error: HttpRouter.handle expects 1 or 3 arguments, got ${args.length}`);
      }),
      get: () => new CosmFunctionValue("get", (args, selfValue) => {
        if (!(selfValue instanceof CosmHttpRouterValue)) {
          throw new Error("Type error: get expects an HttpRouter receiver");
        }
        return selfValue.registerConvenienceRoute("GET", args, "get");
      }),
      post: () => new CosmFunctionValue("post", (args, selfValue) => {
        if (!(selfValue instanceof CosmHttpRouterValue)) {
          throw new Error("Type error: post expects an HttpRouter receiver");
        }
        return selfValue.registerConvenienceRoute("POST", args, "post");
      }),
      put: () => new CosmFunctionValue("put", (args, selfValue) => {
        if (!(selfValue instanceof CosmHttpRouterValue)) {
          throw new Error("Type error: put expects an HttpRouter receiver");
        }
        return selfValue.registerConvenienceRoute("PUT", args, "put");
      }),
      delete: () => new CosmFunctionValue("delete", (args, selfValue) => {
        if (!(selfValue instanceof CosmHttpRouterValue)) {
          throw new Error("Type error: delete expects an HttpRouter receiver");
        }
        return selfValue.registerConvenienceRoute("DELETE", args, "delete");
      }),
      draw: () => new CosmFunctionValue("draw", (args, selfValue, env) => {
        if (!(selfValue instanceof CosmHttpRouterValue)) {
          throw new Error("Type error: draw expects an HttpRouter receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: HttpRouter.draw expects 1 argument, got ${args.length}`);
        }
        const [builder] = args;
        if (builder.type !== "function" && builder.type !== "method") {
          throw new Error("Type error: HttpRouter.draw expects a function or method");
        }
        if (!CosmHttpRouterValue.invokeHandler) {
          throw new Error("HttpRouter runtime error: invoke handler is not installed");
        }
        CosmHttpRouterValue.invokeHandler(
          builder,
          [],
          new CosmHttpRouterDslValue(selfValue),
          env,
        );
        return selfValue;
      }),
      use: () => new CosmFunctionValue("use", (args, selfValue) => {
        if (!(selfValue instanceof CosmHttpRouterValue)) {
          throw new Error("Type error: use expects an HttpRouter receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: HttpRouter.use expects 1 argument, got ${args.length}`);
        }
        const [middleware] = args;
        selfValue.middleware.push(selfValue.normalizeMiddleware(middleware));
        return selfValue;
      }),
    },
  };

  constructor(
    fields: Record<string, CosmValue>,
    classRef?: CosmClassValue,
    public readonly responseClassRef?: CosmClassValue,
    public readonly namespaceClassRef?: CosmClassValue,
    private readonly routes: Map<string, CosmValue> = new Map(),
    private readonly middleware: CosmValue[] = [],
  ) {
    super("HttpRouter", fields, classRef);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmHttpRouterValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmHttpRouterValue.manifest);
  }

  private registerConvenienceRoute(method: string, args: CosmValue[], context: string): CosmHttpRouterValue {
    if (args.length !== 2) {
      throw new Error(`Arity error: HttpRouter.${context} expects 2 arguments, got ${args.length}`);
    }
    this.registerDslRoute(method, args, context);
    return this;
  }

  registerDslRoute(method: string, args: CosmValue[], context: string): void {
    if (args.length !== 2) {
      throw new Error(`Arity error: HttpRouter.${context} expects 2 arguments, got ${args.length}`);
    }
    const [path, handler] = args;
    this.registerRoute(new CosmStringValue(method), path, handler);
  }

  private registerRoute(methodValue: CosmValue, pathValue: CosmValue, handler: CosmValue): void {
    const method = this.expectString(methodValue, "HttpRouter.handle method").toUpperCase();
    const path = this.expectString(pathValue, "HttpRouter.handle path");
    this.routes.set(this.routeKey(method, path), this.normalizeHandler(handler));
  }

  private dispatchRequest(request: CosmHttpRequestValue, env?: CosmEnv): CosmValue {
    if (!CosmHttpRouterValue.invokeHandler) {
      throw new Error("HttpRouter runtime error: invoke handler is not installed");
    }

    const terminal = () => {
      const handler = this.routes.get(this.routeKey(request.method, request.path));
      if (!handler) {
        return new CosmHttpResponseValue(
          404,
          new CosmStringValue(`No route for ${request.method} ${request.path}`),
          new CosmNamespaceValue({}, this.namespaceClassRef),
          this.responseClassRef,
        );
      }
      return CosmHttpRouterValue.invokeHandler!(handler, [request], undefined, env);
    };

    let pipeline = terminal;
    for (const middleware of [...this.middleware].reverse()) {
      const downstream = pipeline;
      pipeline = () => {
        const nextCallable = new CosmFunctionValue("<next>", (args) => {
          if (args.length !== 0) {
            throw new Error(`Arity error: next expects 0 arguments, got ${args.length}`);
          }
          return downstream();
        });
        return CosmHttpRouterValue.invokeHandler!(middleware, [request, nextCallable], undefined, env);
      };
    }

    return pipeline();
  }

  private normalizeHandler(handler: CosmValue): CosmValue {
    if (handler.type === "function" || handler.type === "method") {
      return handler;
    }
    if (handler.type !== "object") {
      throw new Error("Type error: router handlers must be functions, methods, or objects with handle(req)");
    }
    if (!CosmHttpRouterValue.methodLookupHandler) {
      throw new Error("HttpRouter runtime error: method lookup handler is not installed");
    }
    try {
      return CosmHttpRouterValue.methodLookupHandler(handler, new CosmStringValue("handle"));
    } catch (error) {
      if (
        error instanceof Error
        && (
          error.message.includes("has no property 'handle'")
          || error.message.includes("has no instance method 'handle'")
          || error.message.includes("property 'handle' is not a method")
        )
      ) {
        throw new Error("Type error: router handlers must be functions, methods, or objects with handle(req)");
      }
      throw error;
    }
  }

  private normalizeMiddleware(middleware: CosmValue): CosmValue {
    if (middleware.type === "function" || middleware.type === "method") {
      return middleware;
    }
    if (middleware.type !== "object") {
      throw new Error("Type error: router middleware must be functions, methods, or objects with handle(req, next)");
    }
    if (!CosmHttpRouterValue.methodLookupHandler) {
      throw new Error("HttpRouter runtime error: method lookup handler is not installed");
    }
    try {
      return CosmHttpRouterValue.methodLookupHandler(middleware, new CosmStringValue("handle"));
    } catch (error) {
      if (
        error instanceof Error
        && (
          error.message.includes("has no property 'handle'")
          || error.message.includes("has no instance method 'handle'")
          || error.message.includes("property 'handle' is not a method")
        )
      ) {
        throw new Error("Type error: router middleware must be functions, methods, or objects with handle(req, next)");
      }
      throw error;
    }
  }

  private expectString(value: CosmValue, context: string): string {
    if (!(value instanceof CosmStringValue)) {
      throw new Error(`Type error: ${context} expects a string`);
    }
    return value.value;
  }

  private routeKey(method: string, path: string): string {
    return `${method.toUpperCase()} ${path}`;
  }
}
