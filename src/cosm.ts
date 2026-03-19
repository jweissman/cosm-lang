import { CosmValue, CosmClass, CosmEnv, CoreNode, CosmArray, CosmHash, CosmObject, CosmFunction } from './types';
import { Construct } from "./Construct";
import { Parser } from './ast/parser';

function never(_x: never): never {
  throw new Error("Unexpected value: " + _x);
}

namespace Cosm {

  type Repository = {
    globals: Record<string, CosmValue>;
    classes: Record<string, CosmClass>;
  };

  type Env = CosmEnv;

  
  export class Interpreter {
    private static readonly repository = this.createRepository();

    static evalNode(ast: CoreNode, env: Env): CosmValue {
      switch (ast.kind) {
        case 'program':
          return this.evalStatements(ast.children ?? [], env);
        case 'block':
          return this.evalBlock(ast, env);
        case 'class':
          return this.evalClass(ast, env);
        case 'let':
          return this.evalLet(ast, env);
        case 'def':
          return this.evalDef(ast, env);
        case 'if':
          return this.evalIf(ast, env);
        case 'lambda':
          return this.evalLambda(ast, env);
        case 'number':
          return Construct.number(Number(ast.value));
        case 'bool':
          return Construct.bool(ast.value === 'true');
        case 'string':
          if (!ast.children?.length) {
            return Construct.string(ast.value);
          }
          return Construct.string(
            ast.children.map((child) => this.coerceToString(this.evalNode(child, env), 'interpolate')).join(''),
          );
        case 'ident':
          return this.lookupName(ast.value, env);
        case 'ivar':
          return this.evalIvar(ast, env);
        case 'array':
          return Construct.array((ast.children ?? []).map((child) => this.evalNode(child, env)));
        case 'hash':
          return Construct.hash(
            Object.fromEntries(
              (ast.children ?? []).map((child) => {
                if (child.kind !== 'pair' || !child.left) {
                  throw new Error('Invalid AST: hash entries must be key-value pairs');
                }
                return [child.value, this.evalNode(child.left, env)];
              }),
            ),
          );
        case 'access':
          return this.evalAccess(ast, env);
        case 'call':
          return this.evalCall(ast, env);
        case 'add':
          return this.evalAdd(ast, env);
        case 'subtract': {
          const [left, right] = this.evalBinary(ast, 'subtract', env);
          return Construct.number(left - right);
        }
        case 'multiply': {
          const [left, right] = this.evalBinary(ast, 'multiply', env);
          return Construct.number(left * right);
        }
        case 'divide': {
          const [left, right] = this.evalBinary(ast, 'divide', env);
          return Construct.number(left / right);
        }
        case 'pow': {
          const [left, right] = this.evalBinary(ast, 'pow', env);
          return Construct.number(left ** right);
        }
        case 'pos':
          return Construct.number(this.evalUnaryNumber(ast, 'pos', env));
        case 'neg':
          return Construct.number(-this.evalUnaryNumber(ast, 'neg', env));
        case 'not':
          return Construct.bool(!this.evalUnaryBool(ast, 'not', env));
        case 'or': {
          const [left, right] = this.evalBinaryBool(ast, 'or', env);
          return Construct.bool(left || right);
        }
        case 'and': {
          const [left, right] = this.evalBinaryBool(ast, 'and', env);
          return Construct.bool(left && right);
        }
        case 'eq':
          return Construct.bool(this.evalEquality(ast, true, env));
        case 'neq':
          return Construct.bool(this.evalEquality(ast, false, env));
        case 'lt': {
          const [left, right] = this.evalBinary(ast, 'lt', env);
          return Construct.bool(left < right);
        }
        case 'lte': {
          const [left, right] = this.evalBinary(ast, 'lte', env);
          return Construct.bool(left <= right);
        }
        case 'gt': {
          const [left, right] = this.evalBinary(ast, 'gt', env);
          return Construct.bool(left > right);
        }
        case 'gte': {
          const [left, right] = this.evalBinary(ast, 'gte', env);
          return Construct.bool(left >= right);
        }
        default:
          never(ast);
      }
    }

    private static createRepository(): Repository {
      const objectClass = Construct.class('Object');
      const classClass = Construct.class('Class', 'Object', [], {}, {}, objectClass);
      classClass.classRef = classClass;
      const objectMeta = this.createMetaclass('Object', classClass, {}, classClass);
      objectClass.classRef = objectMeta;
      const numberClass = this.createBootClass('Number', objectClass, classClass);
      const booleanClass = this.createBootClass('Boolean', objectClass, classClass);
      const stringClass = this.createBootClass('String', objectClass, classClass);
      const arrayClass = this.createBootClass('Array', objectClass, classClass);
      const hashClass = this.createBootClass('Hash', objectClass, classClass);
      const functionClass = this.createBootClass('Function', objectClass, classClass);

      const classes: Record<string, CosmClass> = {
        Class: classClass,
        Object: objectClass,
        Number: numberClass,
        Boolean: booleanClass,
        String: stringClass,
        Array: arrayClass,
        Hash: hashClass,
        Function: functionClass,
      };

      const globals: Record<string, CosmValue> = {
        Class: classClass,
        Object: objectClass,
        Number: numberClass,
        Boolean: booleanClass,
        String: stringClass,
        Array: arrayClass,
        Hash: hashClass,
        Function: functionClass,
      };

      globals.assert = Construct.nativeFunc('assert', (args) => {
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: assert expects 1 or 2 arguments, got ${args.length}`);
        }
        const [condition, message] = args;
        if (condition.type !== 'bool') {
          throw new Error('Type error: assert expects a boolean argument');
        }
        if (!condition.value) {
          if (message) {
            if (message.type !== 'string') {
              throw new Error('Type error: assert message must be a string');
            }
            throw new Error(`Assertion failed: ${message.value}`);
          }
          throw new Error('Assertion failed');
        }
        return Construct.bool(true);
      });

      return { globals, classes };
    }

    private static createBootClass(name: string, superclass: CosmClass, classClass: CosmClass): CosmClass {
      const classValue = Construct.class(name, superclass.name, [], {}, {}, superclass);
      classValue.classRef = this.createMetaclass(name, superclass.classRef ?? classClass, {}, classClass);
      return classValue;
    }

    private static createMetaclass(name: string, superclassMeta: CosmClass, methods: Record<string, CosmFunction>, classClass: CosmClass): CosmClass {
      return Construct.class(`${name} class`, superclassMeta.name, [], methods, {}, superclassMeta, classClass);
    }

    static createEnv(parent?: Env): Env {
      return { bindings: {}, parent };
    }

    private static evalStatements(statements: CoreNode[], env: Env): CosmValue {
      let result: CosmValue = Construct.bool(true);
      for (const statement of statements) {
        result = this.evalNode(statement, env);
      }
      return result;
    }

    private static evalBlock(ast: CoreNode, env: Env): CosmValue {
      return this.evalStatements(ast.children ?? [], this.createEnv(env));
    }

    private static evalClass(ast: CoreNode, env: Env): CosmValue {
      if (Object.hasOwn(env.bindings, ast.value)) {
        throw new Error(`Name error: duplicate local '${ast.value}'`);
      }
      const superclassName = ast.left?.value || 'Object';
      const superclass = this.lookupClass(superclassName, env);
      const methods = this.collectClassMethods(ast.value, ast.children ?? [], env);
      const classMethods = this.collectClassMethods(ast.value, ast.children ?? [], env, 'class_def');
      const slots = this.collectClassSlots(ast.value, methods, superclass);
      const metaclass = this.createMetaclass(ast.value, superclass.classRef ?? this.repository.classes.Class, classMethods, this.repository.classes.Class);
      const classValue = Construct.class(ast.value, superclass.name, slots, methods, classMethods, superclass, metaclass);
      env.bindings[ast.value] = classValue;
      return classValue;
    }

    private static evalLet(ast: CoreNode, env: Env): CosmValue {
      if (Object.hasOwn(env.bindings, ast.value)) {
        throw new Error(`Name error: duplicate local '${ast.value}'`);
      }
      if (!ast.left) {
        throw new Error("Invalid AST: let node must have a value expression");
      }
      const value = this.evalNode(ast.left, env);
      env.bindings[ast.value] = value;
      return value;
    }

    private static evalDef(ast: CoreNode, env: Env): CosmValue {
      if (Object.hasOwn(env.bindings, ast.value)) {
        throw new Error(`Name error: duplicate local '${ast.value}'`);
      }
      const value = this.buildClosure(ast, env);
      env.bindings[ast.value] = value;
      return value;
    }

    private static evalIf(ast: CoreNode, env: Env): CosmValue {
      const conditionAst = this.expectChild(ast, 'if');
      const condition = this.evalNode(conditionAst, env);
      if (condition.type !== 'bool') {
        throw new Error('Type error: if expects a boolean condition');
      }
      const [thenBranch, elseBranch] = ast.children ?? [];
      if (!thenBranch || !elseBranch) {
        throw new Error('Invalid AST: if node must have then and else branches');
      }
      return this.evalNode(condition.value ? thenBranch : elseBranch, env);
    }

    private static evalLambda(ast: CoreNode, env: Env): CosmValue {
      return this.buildClosure(ast, env);
    }

    private static expectChildren(ast: CoreNode, op: string): [CoreNode, CoreNode] {
      if (!ast.left || !ast.right) {
        throw new Error(`Invalid AST: ${op} node must have left and right children`);
      }
      return [ast.left, ast.right];
    }

    private static expectChild(ast: CoreNode, op: string): CoreNode {
      if (!ast.left) {
        throw new Error(`Invalid AST: ${op} node must have one child`);
      }
      return ast.left;
    }

    private static evalBinary(ast: CoreNode, op: string, env: Env): [number, number] {
      const [leftAst, rightAst] = this.expectChildren(ast, op);
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      if (left.type !== 'number' || right.type !== 'number') {
        throw new Error(`Type error: ${op} expects numeric operands`);
      }
      return [left.value, right.value];
    }

    private static evalAdd(ast: CoreNode, env: Env): CosmValue {
      const [leftAst, rightAst] = this.expectChildren(ast, 'add');
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      try {
        return this.send(left, 'plus', [right]);
      } catch (error) {
        if (error instanceof Error && error.message.includes("has no property 'plus'")) {
          throw new Error('Type error: add expects numeric operands or string concatenation');
        }
        throw error;
      }
    }

    private static evalBinaryBool(ast: CoreNode, op: string, env: Env): [boolean, boolean] {
      const [leftAst, rightAst] = this.expectChildren(ast, op);
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      if (left.type !== 'bool' || right.type !== 'bool') {
        throw new Error(`Type error: ${op} expects boolean operands`);
      }
      return [left.value, right.value];
    }

    private static evalUnaryNumber(ast: CoreNode, op: string, env: Env): number {
      const child = this.evalNode(this.expectChild(ast, op), env);
      if (child.type !== 'number') {
        throw new Error(`Type error: ${op} expects a numeric operand`);
      }
      return child.value;
    }

    private static evalUnaryBool(ast: CoreNode, op: string, env: Env): boolean {
      const child = this.evalNode(this.expectChild(ast, op), env);
      if (child.type !== 'bool') {
        throw new Error(`Type error: ${op} expects a boolean operand`);
      }
      return child.value;
    }

    private static evalEquality(ast: CoreNode, shouldEqual: boolean, env: Env): boolean {
      const [leftAst, rightAst] = this.expectChildren(ast, shouldEqual ? 'eq' : 'neq');
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      return shouldEqual ? this.valuesEqual(left, right) : !this.valuesEqual(left, right);
    }

    private static coerceToString(value: CosmValue, context: 'concatenate' | 'interpolate'): string {
      return value.toCosmString(context);
    }

    private static valuesEqual(left: CosmValue, right: CosmValue): boolean {
      if (left.type !== right.type) {
        return false;
      }
      switch (left.type) {
        case 'number':
        case 'bool':
        case 'string':
          return left.value === (right as typeof left).value;
        case 'class':
          return left.name === (right as CosmClass).name;
        case 'function':
          return left === right;
        case 'array': {
          const rightArray = right as CosmArray;
          return left.items.length === rightArray.items.length
            && left.items.every((item, index) => this.valuesEqual(item, rightArray.items[index]));
        }
        case 'hash': {
          const rightHash = right as CosmHash;
          const leftKeys = Object.keys(left.entries);
          const rightKeys = Object.keys(rightHash.entries);
          return leftKeys.length === rightKeys.length
            && leftKeys.every((key) => key in rightHash.entries && this.valuesEqual(left.entries[key], rightHash.entries[key]));
        }
        case 'object': {
          const rightObject = right as CosmObject;
          return left.className === rightObject.className
            && this.valuesEqual(Construct.hash(left.fields), Construct.hash(rightObject.fields));
        }
      }
    }

    private static lookupName(name: string, env: Env): CosmValue {
      if (name === 'classes') {
        return this.classesObject(env);
      }
      for (let scope: Env | undefined = env; scope; scope = scope.parent) {
        const localValue = scope.bindings[name];
        if (localValue !== undefined) {
          return localValue;
        }
      }
      const value = this.repository.globals[name];
      if (value === undefined) {
        throw new Error(`Name error: unknown identifier '${name}'`);
      }
      return value;
    }

    private static lookupClass(name: string, env: Env): CosmClass {
      const value = this.lookupName(name, env);
      if (value.type !== 'class') {
        throw new Error(`Type error: '${name}' is not a class`);
      }
      return value;
    }

    private static classesObject(env: Env): CosmValue {
      const classes = { ...this.repository.classes };
      for (let scope: Env | undefined = env; scope; scope = scope.parent) {
        for (const [name, value] of Object.entries(scope.bindings)) {
          if (value.type === 'class') {
            classes[name] = value;
          }
        }
      }
      return Construct.object('Object', classes);
    }

    private static evalAccess(ast: CoreNode, env: Env): CosmValue {
      const receiver = this.evalNode(this.expectChild(ast, 'access'), env);
      return this.lookupProperty(receiver, ast.value);
    }

    private static evalCall(ast: CoreNode, env: Env): CosmValue {
      const calleeAst = this.expectChild(ast, 'call');
      const callee = this.evalNode(calleeAst, env);
      const args = (ast.children ?? []).map((child) => this.evalNode(child, env));
      return this.invokeFunction(callee, args);
    }

    private static evalIvar(ast: CoreNode, env: Env): CosmValue {
      const selfValue = this.lookupSelf(env, ast.value);
      const value = selfValue.fields[ast.value];
      if (value === undefined) {
        throw new Error(`Property error: object of class ${selfValue.className} has no ivar '@${ast.value}'`);
      }
      return value;
    }

    private static invokeFunction(callee: CosmValue, args: CosmValue[], selfValue?: CosmValue): CosmValue {
      if (callee.type !== 'function') {
        throw new Error(`Type error: attempted to call a non-function value of type ${callee.type}`);
      }
      if (callee.nativeCall) {
        return callee.nativeCall(args, selfValue);
      }
      if (!callee.params || !callee.body || !callee.env) {
        throw new Error(`Invalid function: ${callee.name}`);
      }
      if (args.length !== callee.params.length) {
        throw new Error(`Arity error: function expects ${callee.params.length} arguments, got ${args.length}`);
      }
      const callEnv = this.createEnv(callee.env);
      if (selfValue) {
        callEnv.bindings.self = selfValue;
      }
      for (const [index, param] of callee.params.entries()) {
        if (Object.hasOwn(callEnv.bindings, param)) {
          throw new Error(`Name error: duplicate parameter '${param}'`);
        }
        callEnv.bindings[param] = args[index];
      }
      return this.evalStatements(callee.body.children ?? [], callEnv);
    }

    private static lookupProperty(receiver: CosmValue, property: string): CosmValue {
      if (property === 'class') {
        return this.classOf(receiver);
      }

      const nativeProperty = receiver.nativeProperty(property);
      if (nativeProperty !== undefined) {
        return nativeProperty;
      }

      const nativeMethod = receiver.nativeMethod(property);
      if (nativeMethod) {
        return this.bindMethod(receiver, nativeMethod);
      }

      switch (receiver.type) {
        case 'array': {
          const method = this.lookupMethod(this.classOf(receiver), property);
          if (method) {
            return this.bindMethod(receiver, method);
          }
          throw new Error(`Property error: Array instance has no property '${property}'`);
        }
        case 'hash': {
          const value = receiver.entries[property];
          if (value === undefined) {
            const method = this.lookupMethod(this.classOf(receiver), property);
            if (method) {
              return this.bindMethod(receiver, method);
            }
            throw new Error(`Property error: Hash instance has no property '${property}'`);
          }
          return value;
        }
        case 'object': {
          const value = receiver.fields[property];
          if (value !== undefined) {
            return value;
          }
          const method = this.lookupMethod(this.classOf(receiver), property);
          if (method) {
            return this.bindMethod(receiver, method);
          }
          throw new Error(`Property error: object of class ${receiver.className} has no property '${property}'`);
        }
        case 'class':
          if (property === 'new') {
            return Construct.nativeFunc(`${receiver.name}.new`, (args) => {
              if (args.length !== receiver.slots.length) {
                throw new Error(`Arity error: ${receiver.name}.new expects ${receiver.slots.length} arguments, got ${args.length}`);
              }
              const instance = this.buildInstance(receiver, args);
              this.invokeInitializerChain(receiver, instance, args);
              return instance;
            });
          }
          {
            const method = this.lookupMethod(this.classOf(receiver), property);
            if (method) {
              return this.bindMethod(receiver, method);
            }
          }
          throw new Error(`Property error: class ${receiver.name} has no property '${property}'`);
        case 'function': {
          const method = this.lookupMethod(this.classOf(receiver), property);
          if (method) {
            return this.bindMethod(receiver, method);
          }
          throw new Error(`Property error: function ${receiver.name} has no property '${property}'`);
        }
        default: {
          const classValue = this.classOf(receiver);
          const method = this.lookupMethod(classValue, property);
          if (method) {
            return this.bindMethod(receiver, method);
          }
          throw new Error(`Property error: ${classValue.name} instance has no property '${property}'`);
        }
      }
    }

    private static classOf(value: CosmValue): CosmClass {
      switch (value.type) {
        case 'number':
          return this.repository.classes.Number;
        case 'bool':
          return this.repository.classes.Boolean;
        case 'string':
          return this.repository.classes.String;
        case 'array':
          return this.repository.classes.Array;
        case 'hash':
          return this.repository.classes.Hash;
        case 'object':
          return value.classRef ?? this.repository.classes[value.className];
        case 'class':
          return value.classRef ?? this.repository.classes.Class;
        case 'function':
          return this.repository.classes.Function;
      }
    }

    static evalInEnv(input: string, env: Env): CosmValue {
      return this.evalNode(Parser.parse(input), env);
    }

    static eval(input: string): CosmValue {
      return this.evalInEnv(input, this.createEnv());
    }

    private static buildClosure(ast: CoreNode, env: Env) {
      const [body] = ast.children ?? [];
      if (!body) {
        throw new Error(`Invalid AST: ${ast.kind} node must have a body`);
      }
      return Construct.closure(ast.value, ast.params ?? [], body, env);
    }

    private static collectClassMethods(className: string, children: CoreNode[], env: Env, kind: 'def' | 'class_def' = 'def'): Record<string, CosmFunction> {
      const methods: Record<string, CosmFunction> = {};
      for (const child of children) {
        if (child.kind !== kind) {
          if (child.kind === 'def' || child.kind === 'class_def') {
            continue;
          }
          throw new Error('Invalid AST: class body currently only supports def members');
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

    private static buildInstance(classValue: CosmClass, args: CosmValue[]): CosmObject {
      const fields = Object.fromEntries(
        classValue.slots.map((slot, index) => [slot, args[index]]),
      );
      return Construct.object(classValue.name, fields, classValue);
    }

    private static invokeInitializerChain(classValue: CosmClass, instance: CosmObject, args: CosmValue[]): void {
      const inheritedSlotCount = classValue.superclass?.slots.length ?? 0;
      const inheritedArgs = args.slice(0, inheritedSlotCount);
      if (classValue.superclass) {
        this.invokeInitializerChain(classValue.superclass, instance, inheritedArgs);
      }

      const initMethod = classValue.methods.init;
      if (!initMethod) {
        return;
      }

      const ownArgs = args.slice(inheritedSlotCount);
      this.invokeFunction(initMethod, ownArgs, instance);
    }

    private static lookupMethod(classValue: CosmClass, name: string): CosmFunction | undefined {
      const method = classValue.methods[name];
      if (method) {
        return method;
      }
      if (classValue.superclass) {
        return this.lookupMethod(classValue.superclass, name);
      }
      return undefined;
    }

    private static bindMethod(receiver: CosmValue, method: CosmFunction): CosmFunction {
      return Construct.nativeFunc(method.name, (args) => this.invokeFunction(method, args, receiver));
    }

    private static send(receiver: CosmValue, message: string, args: CosmValue[]): CosmValue {
      const method = this.lookupProperty(receiver, message);
      return this.invokeFunction(method, args, receiver);
    }

    private static lookupSelf(env: Env, ivarName?: string): CosmObject {
      let selfValue: CosmValue | undefined;
      for (let scope: Env | undefined = env; scope; scope = scope.parent) {
        if (Object.hasOwn(scope.bindings, 'self')) {
          selfValue = scope.bindings.self;
          break;
        }
      }
      if (!selfValue) {
        const suffix = ivarName ? ` '@${ivarName}'` : '';
        throw new Error(`Name error: ivar access${suffix} requires self`);
      }
      if (selfValue.type !== 'object') {
        const suffix = ivarName ? ` for '@${ivarName}'` : '';
        throw new Error(`Type error: self must be an object instance${suffix}`);
      }
      return selfValue;
    }
  }

  export class Values {
    static cosmToJS(value: CosmValue): any {
      switch (value.type) {
        case 'number':
          return value.value;
        case 'bool':
          return value.value;
        case 'string':
          return value.value;
        case 'array':
          return value.items.map((item) => this.cosmToJS(item));
        case 'hash':
          return Object.fromEntries(
            Object.entries(value.entries).map(([key, entry]) => [key, this.cosmToJS(entry)]),
          );
        case 'class':
          return {
            kind: 'class',
            name: value.name,
            superclassName: value.superclassName,
            metaclassName: value.classRef?.name,
            slots: value.slots,
            methods: Object.keys(value.methods),
            classMethods: Object.keys((value.classRef && value.classRef !== value ? value.classRef.methods : value.classMethods)),
            className: (value.classRef ?? this.repository.classes.Class).name,
          };
        case 'object':
          return Object.fromEntries(
            Object.entries(value.fields).map(([key, entry]) => [key, this.cosmToJS(entry)]),
          );
        case 'function':
          return { kind: 'function', name: value.name };
      }
    }

    static format(value: CosmValue): string {
      switch (value.type) {
        case 'number':
          return String(value.value);
        case 'bool':
          return String(value.value);
        case 'string':
          return JSON.stringify(value.value);
        case 'array':
          return `[${value.items.map((item) => this.format(item)).join(', ')}]`;
        case 'hash':
          return `{ ${Object.entries(value.entries).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(', ')} }`;
        case 'function':
          return `<function ${value.name}>`;
        case 'class':
          return value.name;
        case 'object': {
          const entries = Object.entries(value.fields).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(', ');
          if (value.className === 'Object') {
            return `{ ${entries} }`;
          }
          return `#<${value.className} ${entries}>`;
        }
      }
    }
  }

  export const version = "0.1.0";
}
export default Cosm;
