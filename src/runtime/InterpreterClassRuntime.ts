import { Construct } from "../Construct";
import { CoreNode, CosmClass, CosmEnv, CosmFunction, CosmObject, CosmValue } from "../types";
import { Bootstrap } from "./Bootstrap";
import { CosmHttpRouterValue } from "../values/CosmHttpRouterValue";
import { CosmSessionValue } from "../values/CosmSessionValue";
import { InterpreterInvoke } from "./InterpreterInvoke";

type Repository = {
  classes: Record<string, CosmClass>;
};

type ClassRuntimeHooks = {
  lookupClass: (name: string, env: CosmEnv) => CosmClass;
  invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv, currentBlock?: CosmValue) => CosmValue;
  repository: Repository;
};

export class InterpreterClassRuntime {
  static buildClosure(ast: CoreNode, env: CosmEnv): CosmFunction {
    const [body] = ast.children ?? [];
    if (!body) {
      throw new Error(`Invalid AST: ${ast.kind} node must have a body`);
    }
    return Construct.closure(ast.value, ast.params ?? [], body, env, ast.defaults);
  }

  static evalClass(ast: CoreNode, env: CosmEnv, hooks: ClassRuntimeHooks): CosmValue {
    if (Object.hasOwn(env.bindings, ast.value) && !env.allowTopLevelRebinds) {
      throw new Error(`Name error: duplicate local '${ast.value}'`);
    }
    const superclassName = ast.left?.value || "Object";
    const superclass = hooks.lookupClass(superclassName, env);
    const methods = this.collectClassMethods(ast.value, ast.children ?? [], env);
    const classMethods = this.collectClassMethods(ast.value, ast.children ?? [], env, "class_def");
    const slots = this.collectClassSlots(ast.value, methods, superclass);
    const metaclass = Bootstrap.createMetaclass(ast.value, superclass.classRef ?? hooks.repository.classes.Class, classMethods, hooks.repository.classes.Class);
    const classValue = Construct.class(ast.value, superclass.name, slots, methods, classMethods, superclass, metaclass);
    for (const method of Object.values(classValue.methods)) {
      method.declaringOwner = classValue;
      method.declaringOwnerToken = `class:${classValue.name}`;
    }
    for (const method of Object.values(classValue.classMethods)) {
      method.declaringOwner = metaclass;
      method.declaringOwnerToken = `class:${metaclass.name}`;
    }
    env.bindings[ast.value] = classValue;
    return classValue;
  }

  static instantiateClass(classValue: CosmClass, args: CosmValue[], hooks: ClassRuntimeHooks): CosmObject {
    const resolvedArgs = this.resolveInitializerArgs(classValue, args);
    const instance = this.buildInstance(classValue, resolvedArgs, hooks.repository);
    this.invokeInitializerChain(classValue, instance, resolvedArgs, hooks);
    return instance;
  }

  private static collectClassMethods(className: string, children: CoreNode[], env: CosmEnv, kind: "def" | "class_def" = "def"): Record<string, CosmFunction> {
    const methods: Record<string, CosmFunction> = {};
    for (const child of children) {
      if (child.kind !== kind) {
        if (child.kind === "def" || child.kind === "class_def") {
          continue;
        }
        throw new Error("Invalid AST: class body currently only supports def members");
      }
      if (Object.hasOwn(methods, child.value)) {
        throw new Error(`Name error: duplicate method '${child.value}' in class '${className}'`);
      }
      methods[child.value] = this.buildClosure(child, env);
    }
    return methods;
  }

  private static collectClassSlots(className: string, methods: Record<string, CosmFunction>, superclass: CosmClass): string[] {
    const slots = [...superclass.slots];
    const initMethod = methods.init;
    for (const slot of initMethod?.params ?? []) {
      if (slots.includes(slot)) {
        throw new Error(`Name error: duplicate slot '${slot}' in class '${className}'`);
      }
      slots.push(slot);
    }
    return slots;
  }

  private static buildInstance(classValue: CosmClass, args: CosmValue[], repository: Repository): CosmObject {
    if (classValue.name === "HttpRouter") {
      return new CosmHttpRouterValue({}, classValue, repository.classes.HttpResponse, repository.classes.Namespace);
    }
    if (classValue.name === "Session") {
      return new CosmSessionValue(undefined, classValue, repository.classes.Error);
    }
    const fields = Object.fromEntries(
      classValue.slots.map((slot, index) => [slot, args[index]]),
    );
    return Construct.object(classValue.name, fields, classValue);
  }

  private static invokeInitializerChain(classValue: CosmClass, instance: CosmObject, args: CosmValue[], hooks: ClassRuntimeHooks): void {
    const inheritedSlotCount = classValue.superclass?.slots.length ?? 0;
    const inheritedArgs = args.slice(0, inheritedSlotCount);
    if (classValue.superclass) {
      this.invokeInitializerChain(classValue.superclass, instance, inheritedArgs, hooks);
    }

    const initMethod = classValue.methods.init;
    if (!initMethod) {
      return;
    }

    const ownArgs = args.slice(inheritedSlotCount);
    hooks.invokeFunction(Construct.method("init", instance, initMethod, initMethod.declaringOwnerToken), ownArgs, instance);
  }

  private static resolveInitializerArgs(classValue: CosmClass, args: CosmValue[]): CosmValue[] {
    const inheritedArgs = classValue.superclass
      ? this.resolveInitializerArgs(classValue.superclass, args.slice(0, classValue.superclass.slots.length))
      : [];
    const initMethod = classValue.methods.init;
    const ownArgs = args.slice(inheritedArgs.length);
    if (!initMethod?.params) {
      if (ownArgs.length > 0) {
        throw new Error(`Arity error: ${classValue.name}.new expects ${classValue.slots.length} arguments, got ${args.length}`);
      }
      return inheritedArgs;
    }
    const callEnv = { bindings: {}, allowTopLevelRebinds: false } as CosmEnv;
    let resolvedOwnArgs: CosmValue[];
    try {
      resolvedOwnArgs = InterpreterInvoke.resolveFunctionArgs(initMethod, ownArgs, callEnv);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Arity error: function expects")) {
        throw new Error(`Arity error: ${classValue.name}.new expects ${classValue.slots.length} arguments, got ${args.length}`);
      }
      throw error;
    }
    return [...inheritedArgs, ...resolvedOwnArgs];
  }
}
