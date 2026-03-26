import { CoreNode, CosmClass, CosmEnv, CosmValue } from "../types";
import { Construct } from "../Construct";
import { RuntimeDispatch, RuntimeRepository } from "./RuntimeDispatch";

type InvokeHooks = {
  evalNode: (ast: CoreNode, env: CosmEnv) => CosmValue;
  expectChild: (ast: CoreNode, op: string) => CoreNode;
  lookupName: (name: string, env: CosmEnv) => CosmValue;
  createEnv: (parent?: CosmEnv, options?: { allowTopLevelRebinds?: boolean }) => CosmEnv;
  send: (receiver: CosmValue, message: string, args: CosmValue[], env?: CosmEnv) => CosmValue;
  classOf: (value: CosmValue) => CosmClass;
  withFrame: <T>(frame: string, fn: () => T) => T;
  repository: RuntimeRepository;
};

export class InterpreterInvoke {
  static evalCall(ast: CoreNode, env: CosmEnv, hooks: InvokeHooks): CosmValue {
    const calleeAst = hooks.expectChild(ast, "call");
    return hooks.withFrame(`call ${this.describeCallTarget(calleeAst, hooks.expectChild)}`, () => {
      const { args, currentBlock } = this.evaluateCallArgs(ast, env, hooks.evalNode);
      return this.invokeCallTarget(calleeAst, args, env, currentBlock, hooks);
    });
  }

  static evalYield(ast: CoreNode, env: CosmEnv, hooks: InvokeHooks): CosmValue {
    const currentBlock = this.findCurrentBlock(env);
    if (!currentBlock) {
      throw new Error("Block error: yield called without a current block");
    }
    const args = (ast.children ?? []).map((child) => hooks.evalNode(child, env));
    return hooks.withFrame("yield", () => this.invokeFunction(currentBlock, args, undefined, env, undefined, hooks));
  }

  static evalSuper(ast: CoreNode, env: CosmEnv, hooks: InvokeHooks): CosmValue {
    const currentMethod = this.findCurrentMethodContext(env);
    if (!currentMethod) {
      throw new Error("Super error: super(...) called outside a method");
    }
    const selfValue = this.findSelfBinding(env);
    if (!selfValue) {
      throw new Error("Super error: super(...) called without self");
    }
    const args = (ast.children ?? []).map((child) => hooks.evalNode(child, env));
    return hooks.withFrame(`super ${currentMethod.name}`, () => {
      const target = RuntimeDispatch.resolveSuperTarget(
        selfValue,
        currentMethod.name,
        currentMethod.ownerToken,
        hooks.repository,
      );
      return this.invokeFunction(target, args, selfValue, env, undefined, hooks, currentMethod);
    });
  }

  static invokeFunction(
    callee: CosmValue,
    args: CosmValue[],
    selfValue: CosmValue | undefined,
    env: CosmEnv | undefined,
    currentBlock: CosmValue | undefined,
    hooks: InvokeHooks,
    methodContext?: { name: string; ownerToken: string },
  ): CosmValue {
    return hooks.withFrame(`invoke ${this.describeCallable(callee, selfValue)}`, () => {
      const activeBlock = currentBlock ?? (env ? this.findCurrentBlock(env) : undefined);
      if (callee.type === "method") {
        return this.invokeFunction(
          callee.target,
          args,
          callee.receiver,
          env,
          activeBlock,
          hooks,
          callee.ownerToken ? { name: callee.name, ownerToken: callee.ownerToken } : undefined,
        );
      }
      if (callee.type !== "function") {
        throw new Error(`Type error: attempted to call a non-function value of type ${callee.type}`);
      }
      if (callee.nativeCall) {
        return callee.nativeCall(args, selfValue, env);
      }
      if (!callee.params || !callee.body || !callee.env) {
        throw new Error(`Invalid function: ${callee.name}`);
      }
      const callEnv = hooks.createEnv(callee.env);
      callEnv.currentBlock = activeBlock === callee ? this.findOuterBlock(env, activeBlock) : activeBlock;
      callEnv.currentMethodContext = methodContext
        ?? (callee.declaringOwnerToken ? { name: callee.name, ownerToken: callee.declaringOwnerToken } : undefined);
      if (selfValue) {
        callEnv.bindings.self = selfValue;
      }
      const resolvedArgs = this.resolveFunctionArgs(callee, args, callEnv, activeBlock);
      for (const [index, param] of callee.params.entries()) {
        if (Object.hasOwn(callEnv.bindings, param)) {
          throw new Error(`Name error: duplicate parameter '${param}'`);
        }
        callEnv.bindings[param] = resolvedArgs[index];
      }
      if (callee.restParam) {
        if (Object.hasOwn(callEnv.bindings, callee.restParam)) {
          throw new Error(`Name error: duplicate parameter '${callee.restParam}'`);
        }
        callEnv.bindings[callee.restParam] = Construct.array(resolvedArgs.slice(callee.params.length));
      }
      return hooks.evalNode(callee.body, callEnv);
    });
  }

  static resolveFunctionArgs(
    callee: Extract<CosmValue, { type: "function" }>,
    args: CosmValue[],
    callEnv: CosmEnv,
    activeBlock?: CosmValue,
  ): CosmValue[] {
    const effectiveArgs = activeBlock
      && args.length === (callee.params?.length ?? 0) + 1
      && args.at(-1) === activeBlock
      ? args.slice(0, -1)
      : args;
    const params = callee.params ?? [];
    if (!callee.restParam && effectiveArgs.length > params.length) {
      throw new Error(`Arity error: function expects ${params.length} arguments, got ${effectiveArgs.length}`);
    }
    const leadingArgs = callee.restParam ? effectiveArgs.slice(0, params.length) : effectiveArgs;
    const restArgs = callee.restParam ? effectiveArgs.slice(params.length) : [];
    const resolvedArgs = [...leadingArgs];
    for (let index = leadingArgs.length; index < params.length; index += 1) {
      const param = params[index];
      const defaultExpr = callee.defaults?.[param];
      if (!defaultExpr) {
        throw new Error(`Arity error: function expects ${params.length} arguments, got ${effectiveArgs.length}`);
      }
      const transientBindings: string[] = [];
      for (let prior = 0; prior < index; prior += 1) {
        const priorParam = params[prior];
        if (!Object.hasOwn(callEnv.bindings, priorParam)) {
          transientBindings.push(priorParam);
        }
        callEnv.bindings[priorParam] = resolvedArgs[prior];
      }
      const defaultValue = this.evalDefault(defaultExpr, callEnv);
      for (const binding of transientBindings) {
        delete callEnv.bindings[binding];
      }
      resolvedArgs.push(defaultValue);
    }
    return [...resolvedArgs, ...restArgs];
  }

  static findCurrentBlock(env: CosmEnv): CosmValue | undefined {
    for (let scope: CosmEnv | undefined = env; scope; scope = scope.parent) {
      if (scope.currentBlock) {
        return scope.currentBlock;
      }
    }
    return undefined;
  }

  static findCurrentMethodContext(env: CosmEnv): { name: string; ownerToken: string } | undefined {
    for (let scope: CosmEnv | undefined = env; scope; scope = scope.parent) {
      if (scope.currentMethodContext) {
        return scope.currentMethodContext;
      }
    }
    return undefined;
  }

  static describeValue(value: CosmValue): string {
    switch (value.type) {
      case "class":
        return value.name;
      case "object":
        return value.className;
      case "function":
        return value.name;
      case "method":
        return `${this.describeValue(value.receiver)}.${value.name}`;
      case "string":
        return JSON.stringify(value.value);
      case "symbol":
        return `:${value.name}`;
      default:
        return value.type;
    }
  }

  private static evaluateCallArgs(
    ast: CoreNode,
    env: CosmEnv,
    evalNode: (ast: CoreNode, env: CosmEnv) => CosmValue,
  ): { args: CosmValue[]; currentBlock?: CosmValue } {
    const blockArg = ast.target === "trailing_block" ? (ast.children ?? []).at(-1) : undefined;
    const currentBlock = blockArg ? evalNode(blockArg, env) : undefined;
    const args = (ast.children ?? []).map((child) => child === blockArg && currentBlock ? currentBlock : evalNode(child, env));
    return { args, currentBlock };
  }

  private static invokeCallTarget(
    calleeAst: CoreNode,
    args: CosmValue[],
    env: CosmEnv,
    currentBlock: CosmValue | undefined,
    hooks: InvokeHooks,
  ): CosmValue {
    if (calleeAst.kind === "access") {
      const receiver = hooks.evalNode(hooks.expectChild(calleeAst, "access"), env);
      return RuntimeDispatch.invokeAccessCall(
        receiver,
        calleeAst.value,
        args,
        hooks.repository,
        (callee, invokeArgs, selfValue, scope) => this.invokeFunction(callee, invokeArgs, selfValue, scope, currentBlock, hooks),
        env,
      );
    }
    if (calleeAst.kind === "ident") {
      return this.invokeNamedCall(calleeAst.value, args, env, currentBlock, hooks);
    }
    const callee = hooks.evalNode(calleeAst, env);
    return this.invokeFunction(callee, args, undefined, env, currentBlock, hooks);
  }

  private static invokeNamedCall(
    name: string,
    args: CosmValue[],
    env: CosmEnv,
    currentBlock: CosmValue | undefined,
    hooks: InvokeHooks,
  ): CosmValue {
    try {
      const callee = hooks.lookupName(name, env);
      return this.invokeFunction(callee, args, undefined, env, currentBlock, hooks);
    } catch (error) {
      const selfValue = this.findSelfBinding(env);
      if (selfValue && error instanceof Error && error.message === `Name error: unknown identifier '${name}'`) {
        return hooks.send(selfValue, name, args, env);
      }
      throw error;
    }
  }

  private static evalDefault(defaultExpr: CoreNode, env: CosmEnv): CosmValue {
    return this.defaultEvalHook(defaultExpr, env);
  }

  private static defaultEvalHook(ast: CoreNode, _env: CosmEnv): CosmValue {
    throw new Error(`Interpreter invoke runtime error: default eval hook not installed for '${ast.kind}'`);
  }

  static installHooks(hooks: { evalDefault: (ast: CoreNode, env: CosmEnv) => CosmValue }): void {
    this.defaultEvalHook = hooks.evalDefault;
  }

  private static findSelfBinding(env: CosmEnv): CosmValue | undefined {
    for (let scope: CosmEnv | undefined = env; scope; scope = scope.parent) {
      if (Object.hasOwn(scope.bindings, "self")) {
        return scope.bindings.self;
      }
    }
    return undefined;
  }

  private static findOuterBlock(env: CosmEnv | undefined, currentBlock: CosmValue): CosmValue | undefined {
    let skippedCurrent = false;
    for (let scope: CosmEnv | undefined = env; scope; scope = scope.parent) {
      if (!scope.currentBlock) {
        continue;
      }
      if (!skippedCurrent && scope.currentBlock === currentBlock) {
        skippedCurrent = true;
        continue;
      }
      return scope.currentBlock;
    }
    return undefined;
  }

  private static describeCallTarget(ast: CoreNode, expectChild: (ast: CoreNode, op: string) => CoreNode): string {
    if (ast.kind === "ident") {
      return ast.value;
    }
    if (ast.kind === "access") {
      return `${this.describeCallTarget(expectChild(ast, "access"), expectChild)}.${ast.value}`;
    }
    if (ast.kind === "call") {
      return this.describeCallTarget(expectChild(ast, "call"), expectChild);
    }
    return `<${ast.kind}>`;
  }

  private static describeCallable(callee: CosmValue, selfValue?: CosmValue): string {
    if (callee.type === "method") {
      return `${this.describeValue(callee.receiver)}.${callee.name}`;
    }
    if (callee.type === "function") {
      if (selfValue) {
        return `${this.describeValue(selfValue)}.${callee.name}`;
      }
      return callee.name;
    }
    return callee.type;
  }
}
