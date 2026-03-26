import { CoreNode, CosmClass, CosmEnv, CosmObject, CosmValue } from "../types";
import { RuntimeDispatch, RuntimeRepository } from "./RuntimeDispatch";

type LookupHooks = {
  lookupProperty: (receiver: CosmValue, property: string) => CosmValue;
  classesObject: (env: CosmEnv) => CosmValue;
  evalNode: (ast: CoreNode, env: CosmEnv) => CosmValue;
  expectChild: (ast: CoreNode, op: string) => CoreNode;
  withFrame: <T>(frame: string, fn: () => T) => T;
  repository: RuntimeRepository;
};

export class InterpreterLookup {
  static lookupName(name: string, env: CosmEnv, hooks: LookupHooks): CosmValue {
    if (name === "classes") {
      return hooks.classesObject(env);
    }
    for (let scope: CosmEnv | undefined = env; scope; scope = scope.parent) {
      const localValue = scope.bindings[name];
      if (localValue !== undefined) {
        return localValue;
      }
    }
    const selfValue = this.lookupImplicitSelf(name, env, hooks.repository);
    if (selfValue !== undefined) {
      return selfValue;
    }
    const value = hooks.repository.globals[name];
    if (value === undefined) {
      throw new Error(`Name error: unknown identifier '${name}'`);
    }
    return value;
  }

  static lookupClass(name: string, env: CosmEnv, hooks: LookupHooks): CosmClass {
    const value = this.lookupName(name, env, hooks);
    if (value.type !== "class") {
      throw new Error(`Type error: '${name}' is not a class`);
    }
    return value;
  }

  static evalAccess(ast: CoreNode, env: CosmEnv, hooks: LookupHooks): CosmValue {
    return hooks.withFrame(`access ${this.describeAccessTarget(ast)}`, () => {
      const receiver = hooks.evalNode(hooks.expectChild(ast, "access"), env);
      return hooks.lookupProperty(receiver, ast.value);
    });
  }

  static evalIvar(ast: CoreNode, env: CosmEnv): CosmValue {
    const selfValue = this.lookupSelf(env, ast.value);
    const value = selfValue.fields[ast.value];
    if (value === undefined) {
      throw new Error(`Property error: object of class ${selfValue.className} has no ivar '@${ast.value}'`);
    }
    return value;
  }

  static lookupSelf(env: CosmEnv, ivarName?: string): CosmObject {
    const selfValue = this.findSelfBinding(env);
    if (!selfValue) {
      const suffix = ivarName ? ` '@${ivarName}'` : "";
      throw new Error(`Name error: ivar access${suffix} requires self`);
    }
    if (selfValue.type !== "object") {
      const suffix = ivarName ? ` for '@${ivarName}'` : "";
      throw new Error(`Type error: self must be an object instance${suffix}`);
    }
    return selfValue;
  }

  static findSelfBinding(env: CosmEnv): CosmValue | undefined {
    for (let scope: CosmEnv | undefined = env; scope; scope = scope.parent) {
      if (Object.hasOwn(scope.bindings, "self")) {
        return scope.bindings.self;
      }
    }
    return undefined;
  }

  static findCurrentBlock(env: CosmEnv): CosmValue | undefined {
    for (let scope: CosmEnv | undefined = env; scope; scope = scope.parent) {
      if (scope.currentBlock) {
        return scope.currentBlock;
      }
    }
    return undefined;
  }

  static describeAccessTarget(ast: CoreNode): string {
    if (ast.kind !== "access") {
      return ast.value;
    }
    const receiver = ast.left;
    if (!receiver) {
      return ast.value;
    }
    if (receiver.kind === "ident") {
      return `${receiver.value}.${ast.value}`;
    }
    if (receiver.kind === "access") {
      return `${this.describeAccessTarget(receiver)}.${ast.value}`;
    }
    return ast.value;
  }

  private static lookupImplicitSelf(name: string, env: CosmEnv, repository: RuntimeRepository): CosmValue | undefined {
    const selfValue = this.findSelfBinding(env);
    if (!selfValue) {
      return undefined;
    }
    try {
      return RuntimeDispatch.resolveSendTarget(selfValue, name, repository);
    } catch (error) {
      if (
        error instanceof Error
        && (
          error.message.includes(`has no property '${name}'`)
          || error.message.includes(`has no instance method '${name}'`)
          || error.message.includes(`has no class method '${name}'`)
        )
      ) {
        return undefined;
      }
      throw error;
    }
  }
}
