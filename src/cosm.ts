import { CosmValue, CosmClass, CosmEnv, CoreNode, CosmObject, IrProgram, SurfaceNode } from './types';
import { Construct } from "./Construct";
import { Parser } from './ast/parser';
import { RuntimeDispatch } from './runtime/RuntimeDispatch';
import { Bootstrap } from './runtime/Bootstrap';
import { CosmErrorValue } from './values/CosmErrorValue';
import { CosmRaisedError } from './runtime/CosmRaisedError';
import { CosmSessionValue } from './values/CosmSessionValue';
import { ValueAdapter } from './ValueAdapter';
import { RuntimeIr } from './runtime/RuntimeIr';
import { InterpreterClassRuntime } from './runtime/InterpreterClassRuntime';
import { InterpreterRoots } from './runtime/InterpreterRoots';
import { InterpreterInvoke } from './runtime/InterpreterInvoke';

function never(_x: never): never {
  throw new Error("Unexpected value: " + _x);
}

namespace Cosm {

  type Repository = {
    globals: Record<string, CosmValue>;
    classes: Record<string, CosmClass>;
    modules: Record<string, CosmObject>;
  };

  type Env = CosmEnv;

  
  export class Interpreter {
    private static readonly repository = this.createRepository();
    private static readonly symbolTable = new Map<string, CosmValue>();
    private static defaultSessionValue?: CosmSessionValue;
    private static bootRepository?: Repository;

    private static repo(): Repository {
      return this.bootRepository ?? this.repository;
    }

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
        case 'require':
          return this.evalRequire(ast, env);
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
        case 'symbol':
          return this.internSymbol(ast.value);
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
        case 'yield':
          return this.evalYield(ast, env);
        case 'add':
          return this.evalAdd(ast, env);
        case 'subtract': {
          return this.evalArithmeticSend(ast, 'subtract', env, 'subtract expects numeric operands');
        }
        case 'multiply': {
          return this.evalArithmeticSend(ast, 'multiply', env, 'multiply expects numeric operands');
        }
        case 'divide': {
          return this.evalArithmeticSend(ast, 'divide', env, 'divide expects numeric operands');
        }
        case 'pow': {
          return this.evalArithmeticSend(ast, 'pow', env, 'pow expects numeric operands');
        }
        case 'pos':
          return this.evalUnarySend(ast, 'pos', env, 'pos expects a numeric operand');
        case 'neg':
          return this.evalUnarySend(ast, 'neg', env, 'neg expects a numeric operand');
        case 'not':
          return this.evalUnarySend(ast, 'not', env, 'not expects a boolean operand');
        case 'or': {
          return this.evalLogicSend(ast, 'or', env);
        }
        case 'and': {
          return this.evalLogicSend(ast, 'and', env);
        }
        case 'eq':
          return Construct.bool(this.evalEquality(ast, true, env));
        case 'semantic_eq':
          return this.evalSemanticEquality(ast, env);
        case 'neq':
          return Construct.bool(this.evalEquality(ast, false, env));
        case 'lt':
          return Construct.bool(this.evalComparison(ast, 'lt', env));
        case 'lte':
          return Construct.bool(this.evalComparison(ast, 'lte', env));
        case 'gt':
          return Construct.bool(this.evalComparison(ast, 'gt', env));
        case 'gte':
          return Construct.bool(this.evalComparison(ast, 'gte', env));
        default:
          never(ast);
      }
    }

    private static createRepository(): Repository {
      InterpreterInvoke.installHooks({
        evalDefault: (ast, env) => this.evalNode(ast, env),
      });
      const repository = Bootstrap.createRepository({
        invokeFunction: (callee, args, selfValue, env) => this.invokeFunction(callee, args, selfValue, env),
        instantiateClass: (classValue, args) => this.instantiateClass(classValue, args),
        invokeSend: (receiver, messageValue, args, env) => this.invokeSend(receiver, messageValue, args, env),
        classOf: (value) => this.classOf(value),
        internSymbol: (name) => this.internSymbol(name),
        loadModule: (name, env) => this.loadModule(name, env),
        evalSource: (source) => this.evalSharedKernelSource(source),
        evalInEnv: (source, env) => this.evalInEnv(source, env),
        inspectValue: (value, env) => this.inspect(value, env),
        createSessionEnv: () => this.createEnv(undefined, { allowTopLevelRebinds: true }),
        defaultSession: () => this.defaultSession(),
        resetEvalSource: () => this.resetSharedKernelEnv(),
      });
      this.bootRepository = repository;
      Bootstrap.setCurrentRepository(repository);
      this.preloadStdlibModules(repository);
      return repository;
    }

    static createEnv(parent?: Env, options?: { allowTopLevelRebinds?: boolean }): Env {
      return {
        bindings: {},
        parent,
        allowTopLevelRebinds: options?.allowTopLevelRebinds ?? false,
      };
    }

    private static evalSharedKernelSource(source: string): CosmValue {
      return this.withFrame('eval <shared>', () => this.defaultSession().evalSource(source));
    }

    private static resetSharedKernelEnv(): void {
      this.defaultSession().reset();
    }

    private static defaultSession(): CosmSessionValue {
      if (!this.defaultSessionValue) {
        this.defaultSessionValue = new CosmSessionValue('default', this.repo().classes.Session, this.repo().classes.Error);
      }
      return this.defaultSessionValue;
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

    private static evalRequire(ast: CoreNode, env: Env): CosmValue {
      const target = this.evalNode(this.expectChild(ast, 'require'), env);
      return this.invokeFunction(this.repo().globals.require, [target], undefined, env);
    }

    private static loadModule(name: string, _env: Env): CosmObject | undefined {
      return InterpreterRoots.loadModuleIntoRepository(name, this.repo(), {
        createEnv: (parent, options) => this.createEnv(parent, options),
        evalInEnv: (source, scope) => this.evalInEnv(source, scope),
      });
    }

    private static preloadStdlibModules(repository: Repository): void {
      InterpreterRoots.preloadStdlibModules(repository, {
        createEnv: (parent, options) => this.createEnv(parent, options),
        evalInEnv: (source, env) => this.evalInEnv(source, env),
      });
      const enumerableModule = repository.modules["cosm/enumerable.cosm"];
      if (enumerableModule?.type === "object" && enumerableModule.className === "Module") {
        repository.classes.Array.includeModule(enumerableModule);
        repository.classes.Hash.includeModule(enumerableModule);
      }
    }

    private static evalClass(ast: CoreNode, env: Env): CosmValue {
      return InterpreterClassRuntime.evalClass(ast, env, {
        lookupClass: (name, scope) => this.lookupClass(name, scope),
        invokeFunction: (callee, args, selfValue, scope, currentBlock) => this.invokeFunction(callee, args, selfValue, scope, currentBlock),
        repository: { classes: this.repo().classes },
      });
    }

    private static evalLet(ast: CoreNode, env: Env): CosmValue {
      if (Object.hasOwn(env.bindings, ast.value) && !env.allowTopLevelRebinds) {
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
      if (Object.hasOwn(env.bindings, ast.value) && !env.allowTopLevelRebinds) {
        throw new Error(`Name error: duplicate local '${ast.value}'`);
      }
      const value = InterpreterClassRuntime.buildClosure(ast, env);
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
      return InterpreterClassRuntime.buildClosure(ast, env);
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

    private static evalArithmeticSend(ast: CoreNode, message: 'subtract' | 'multiply' | 'divide' | 'pow', env: Env, fallbackMessage: string): CosmValue {
      const [leftAst, rightAst] = this.expectChildren(ast, message);
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      try {
        return this.send(left, message, [right]);
      } catch (error) {
        if (error instanceof Error && error.message.includes(`'${message}'`)) {
          throw new Error(`Type error: ${fallbackMessage}`);
        }
        throw error;
      }
    }

    private static evalLogicSend(ast: CoreNode, message: 'and' | 'or', env: Env): CosmValue {
      const [leftAst, rightAst] = this.expectChildren(ast, message);
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      try {
        return this.send(left, message, [right]);
      } catch (error) {
        if (error instanceof Error && error.message.includes(`'${message}'`)) {
          throw new Error(`Type error: ${message} expects boolean operands`);
        }
        throw error;
      }
    }

    private static evalUnarySend(ast: CoreNode, message: 'pos' | 'neg' | 'not', env: Env, fallbackMessage: string): CosmValue {
      const child = this.evalNode(this.expectChild(ast, message), env);
      try {
        return this.send(child, message, []);
      } catch (error) {
        if (error instanceof Error && error.message.includes(`'${message}'`)) {
          throw new Error(`Type error: ${fallbackMessage}`);
        }
        throw error;
      }
    }

    private static evalEquality(ast: CoreNode, shouldEqual: boolean, env: Env): boolean {
      const [leftAst, rightAst] = this.expectChildren(ast, shouldEqual ? 'eq' : 'neq');
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      const result = this.send(left, 'eq', [right]);
      if (result.type !== 'bool') {
        throw new Error('Type error: method eq must return a boolean');
      }
      const equal = result.value;
      return shouldEqual ? equal : !equal;
    }

    private static evalComparison(ast: CoreNode, op: 'lt' | 'lte' | 'gt' | 'gte', env: Env): boolean {
      const [leftAst, rightAst] = this.expectChildren(ast, op);
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      const result = this.tryNativePredicate(left, op, right);
      if (result === null) {
        throw new Error(`Type error: ${op} expects numeric operands`);
      }
      return result;
    }

    private static evalSemanticEquality(ast: CoreNode, env: Env): CosmValue {
      const [leftAst, rightAst] = this.expectChildren(ast, 'semantic_eq');
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      return this.send(left, 'semanticEq', [right]);
    }

    private static coerceToString(value: CosmValue, context: 'concatenate' | 'interpolate'): string {
      return value.toCosmString(context);
    }

    private static tryNativePredicate(left: CosmValue, message: 'eq' | 'lt' | 'lte' | 'gt' | 'gte', right: CosmValue): boolean | null {
      const nativeMethod = left.nativeMethod(message);
      if (!nativeMethod) {
        return null;
      }
      const result = this.invokeFunction(nativeMethod, [right], left);
      if (result.type !== 'bool') {
        throw new Error(`Type error: method ${message} must return a boolean`);
      }
      return result.value;
    }

    private static lookupName(name: string, env: Env): CosmValue {
      if (name === 'classes') {
        return this.classesObject(env);
      }
      if (name === 'cosm') {
        return this.cosmObject(env);
      }
      for (let scope: Env | undefined = env; scope; scope = scope.parent) {
        const localValue = scope.bindings[name];
        if (localValue !== undefined) {
          return localValue;
        }
      }
      const selfValue = this.lookupImplicitSelf(name, env);
      if (selfValue !== undefined) {
        return selfValue;
      }
      const value = this.repo().globals[name];
      if (value === undefined) {
        throw new Error(`Name error: unknown identifier '${name}'`);
      }
      return value;
    }

    private static lookupImplicitSelf(name: string, env: Env): CosmValue | undefined {
      const selfValue = this.findSelfBinding(env);
      if (!selfValue) {
        return undefined;
      }
      try {
        return RuntimeDispatch.resolveSendTarget(selfValue, name, this.repo());
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

    private static lookupClass(name: string, env: Env): CosmClass {
      const value = this.lookupName(name, env);
      if (value.type !== 'class') {
        throw new Error(`Type error: '${name}' is not a class`);
      }
      return value;
    }

    private static classesObject(env: Env): CosmValue {
      return InterpreterRoots.classesObject(env, this.repo());
    }

    private static cosmObject(env: Env): CosmValue {
      return InterpreterRoots.cosmObject(env, this.repo(), version);
    }

    private static evalAccess(ast: CoreNode, env: Env): CosmValue {
      return this.withFrame(`access ${this.describeAccessTarget(ast)}`, () => {
        const receiver = this.evalNode(this.expectChild(ast, 'access'), env);
        return this.lookupProperty(receiver, ast.value);
      });
    }

    private static evalCall(ast: CoreNode, env: Env): CosmValue {
      return InterpreterInvoke.evalCall(ast, env, {
        evalNode: (node, scope) => this.evalNode(node, scope),
        expectChild: (node, op) => this.expectChild(node, op),
        lookupName: (name, scope) => this.lookupName(name, scope),
        createEnv: (parent, options) => this.createEnv(parent, options),
        send: (receiver, message, args, scope) => this.send(receiver, message, args, scope),
        withFrame: (frame, fn) => this.withFrame(frame, fn),
        repository: this.repo(),
      });
    }

    private static evalYield(ast: CoreNode, env: Env): CosmValue {
      return InterpreterInvoke.evalYield(ast, env, {
        evalNode: (node, scope) => this.evalNode(node, scope),
        expectChild: (node, op) => this.expectChild(node, op),
        lookupName: (name, scope) => this.lookupName(name, scope),
        createEnv: (parent, options) => this.createEnv(parent, options),
        send: (receiver, message, args, scope) => this.send(receiver, message, args, scope),
        withFrame: (frame, fn) => this.withFrame(frame, fn),
        repository: this.repo(),
      });
    }

    private static evalIvar(ast: CoreNode, env: Env): CosmValue {
      const selfValue = this.lookupSelf(env, ast.value);
      const value = selfValue.fields[ast.value];
      if (value === undefined) {
        throw new Error(`Property error: object of class ${selfValue.className} has no ivar '@${ast.value}'`);
      }
      return value;
    }

    private static invokeFunction(callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: Env, currentBlock?: CosmValue): CosmValue {
      return InterpreterInvoke.invokeFunction(callee, args, selfValue, env, currentBlock, {
        evalNode: (node, scope) => this.evalNode(node, scope),
        expectChild: (node, op) => this.expectChild(node, op),
        lookupName: (name, scope) => this.lookupName(name, scope),
        createEnv: (parent, options) => this.createEnv(parent, options),
        send: (receiver, message, invokeArgs, scope) => this.send(receiver, message, invokeArgs, scope),
        withFrame: (frame, fn) => this.withFrame(frame, fn),
        repository: this.repo(),
      });
    }

    private static lookupProperty(receiver: CosmValue, property: string): CosmValue {
      return RuntimeDispatch.lookupProperty(receiver, property, this.repo());
    }

    private static classOf(value: CosmValue): CosmClass {
      return RuntimeDispatch.classOf(value, this.repo().classes);
    }

    static evalInEnv(input: string, env: Env): CosmValue {
      return this.withFrame('eval <input>', () => this.evalNode(this.coreAst(input), env));
    }

    static eval(input: string): CosmValue {
      return this.evalInEnv(input, this.createEnv());
    }

    static evalVmInEnv(input: string, env: Env): CosmValue {
      return this.withFrame('vm <input>', () =>
        RuntimeIr.execute(this.ir(input), env, {
          lookupName: (name, scope) => this.lookupName(name, scope),
          lookupProperty: (receiver, property) => this.lookupProperty(receiver, property),
          invokeFunction: (callee, args, selfValue, scope) => this.invokeFunction(callee, args, selfValue, scope),
          send: (receiver, message, args, scope) => this.send(receiver, message, args, scope),
          internSymbol: (name) => this.internSymbol(name),
          createEnv: (parent) => this.createEnv(parent),
          repository: this.repo(),
        })
      );
    }

    static evalVm(input: string): CosmValue {
      return this.evalVmInEnv(input, this.createEnv());
    }

    static surfaceAst(input: string): SurfaceNode {
      return Parser.parseSurface(input);
    }

    static coreAst(input: string): CoreNode {
      return Parser.parse(input);
    }

    static ir(input: string): IrProgram {
      return RuntimeIr.compile(this.coreAst(input));
    }

    static inspect(value: CosmValue, env?: Env): string {
      try {
        const rendered = this.invokeSend(value, this.internSymbol("inspect"), [], env);
        if (rendered.type === "string") {
          return rendered.value;
        }
      } catch {
        // Fall back only when inspect itself cannot be resolved.
      }
      return ValueAdapter.format(value);
    }

    private static instantiateClass(classValue: CosmClass, args: CosmValue[]): CosmObject {
      return InterpreterClassRuntime.instantiateClass(classValue, args, {
        lookupClass: (name, env) => this.lookupClass(name, env),
        invokeFunction: (callee, invokeArgs, selfValue, env, currentBlock) => this.invokeFunction(callee, invokeArgs, selfValue, env, currentBlock),
        repository: { classes: this.repo().classes },
      });
    }

    private static send(receiver: CosmValue, message: string, args: CosmValue[], env?: Env): CosmValue {
      const currentBlock = env ? this.findCurrentBlock(env) : undefined;
      return this.withFrame(`send ${this.describeValue(receiver)}.${message}`, () =>
        RuntimeDispatch.send(receiver, message, args, this.repo(), (callee, invokeArgs, selfValue, env) =>
          this.invokeFunction(callee, invokeArgs, selfValue, env, currentBlock)
        )
      );
    }

    private static invokeSend(receiver: CosmValue, messageValue: CosmValue, args: CosmValue[], env?: Env): CosmValue {
      const currentBlock = env ? this.findCurrentBlock(env) : undefined;
      return this.withFrame(`send ${this.describeValue(receiver)}.${RuntimeDispatch.messageName(messageValue)}`, () =>
        RuntimeDispatch.invokeSend(receiver, messageValue, args, this.repo(), (callee, invokeArgs, selfValue, env) =>
          this.invokeFunction(callee, invokeArgs, selfValue, env, currentBlock)
        , env)
      );
    }

    private static withFrame<T>(frame: string, fn: () => T): T {
      try {
        return fn();
      } catch (error) {
        throw this.wrapWithFrame(error, frame);
      }
    }

    private static wrapWithFrame(error: unknown, frame: string): CosmRaisedError {
      const cosmError = CosmErrorValue.fromUnknown(error, this.repo().classes.Error);
      if (cosmError.backtraceItems[cosmError.backtraceItems.length - 1] !== frame) {
        cosmError.backtraceItems.push(frame);
      }
      return new CosmRaisedError(cosmError);
    }

    private static describeAccessTarget(ast: CoreNode): string {
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

    private static describeValue(value: CosmValue): string {
      switch (value.type) {
        case 'class':
          return value.name;
        case 'object':
          return value.className;
        case 'function':
          return value.name;
        case 'method':
          return `${this.describeValue(value.receiver)}.${value.name}`;
        case 'string':
          return JSON.stringify(value.value);
        case 'symbol':
          return `:${value.name}`;
        default:
          return value.type;
      }
    }

    private static lookupSelf(env: Env, ivarName?: string): CosmObject {
      const selfValue = this.findSelfBinding(env);
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

    private static findSelfBinding(env: Env): CosmValue | undefined {
      for (let scope: Env | undefined = env; scope; scope = scope.parent) {
        if (Object.hasOwn(scope.bindings, 'self')) {
          return scope.bindings.self;
        }
      }
      return undefined;
    }

    private static findCurrentBlock(env: Env): CosmValue | undefined {
      for (let scope: Env | undefined = env; scope; scope = scope.parent) {
        if (scope.currentBlock) {
          return scope.currentBlock;
        }
      }
      return undefined;
    }

    private static internSymbol(name: string): CosmValue {
      const existing = this.symbolTable.get(name);
      if (existing) {
        return existing;
      }
      const symbol = Construct.symbol(name);
      this.symbolTable.set(name, symbol);
      return symbol;
    }
  }

    export const version = "0.3.12.2";
}
export default Cosm;
