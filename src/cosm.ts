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
import { InterpreterLookup } from './runtime/InterpreterLookup';
import { InterpreterMessage } from './runtime/InterpreterMessage';
import { InterpreterOperators } from './runtime/InterpreterOperators';

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
          return InterpreterOperators.evalAdd(ast, env, this.operatorHooks());
        case 'subtract': {
          return InterpreterOperators.evalArithmeticSend(ast, 'subtract', env, 'subtract expects numeric operands', this.operatorHooks());
        }
        case 'multiply': {
          return InterpreterOperators.evalArithmeticSend(ast, 'multiply', env, 'multiply expects numeric operands', this.operatorHooks());
        }
        case 'divide': {
          return InterpreterOperators.evalArithmeticSend(ast, 'divide', env, 'divide expects numeric operands', this.operatorHooks());
        }
        case 'pow': {
          return InterpreterOperators.evalArithmeticSend(ast, 'pow', env, 'pow expects numeric operands', this.operatorHooks());
        }
        case 'pos':
          return InterpreterOperators.evalUnarySend(ast, 'pos', env, 'pos expects a numeric operand', this.operatorHooks());
        case 'neg':
          return InterpreterOperators.evalUnarySend(ast, 'neg', env, 'neg expects a numeric operand', this.operatorHooks());
        case 'not':
          return InterpreterOperators.evalUnarySend(ast, 'not', env, 'not expects a boolean operand', this.operatorHooks());
        case 'or': {
          return InterpreterOperators.evalLogicSend(ast, 'or', env, this.operatorHooks());
        }
        case 'and': {
          return InterpreterOperators.evalLogicSend(ast, 'and', env, this.operatorHooks());
        }
        case 'eq':
          return Construct.bool(InterpreterOperators.evalEquality(ast, true, env, this.operatorHooks()));
        case 'semantic_eq':
          return InterpreterOperators.evalSemanticEquality(ast, env, this.operatorHooks());
        case 'neq':
          return Construct.bool(InterpreterOperators.evalEquality(ast, false, env, this.operatorHooks()));
        case 'lt':
          return Construct.bool(InterpreterOperators.evalComparison(ast, 'lt', env, this.operatorHooks()));
        case 'lte':
          return Construct.bool(InterpreterOperators.evalComparison(ast, 'lte', env, this.operatorHooks()));
        case 'gt':
          return Construct.bool(InterpreterOperators.evalComparison(ast, 'gt', env, this.operatorHooks()));
        case 'gte':
          return Construct.bool(InterpreterOperators.evalComparison(ast, 'gte', env, this.operatorHooks()));
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

    private static coerceToString(value: CosmValue, context: 'concatenate' | 'interpolate'): string {
      return value.toCosmString(context);
    }

    private static lookupName(name: string, env: Env): CosmValue {
      return InterpreterLookup.lookupName(name, env, {
        lookupProperty: (receiver, property) => this.lookupProperty(receiver, property),
        classesObject: (scope) => this.classesObject(scope),
        cosmObject: (scope) => this.cosmObject(scope),
        evalNode: (ast, scope) => this.evalNode(ast, scope),
        expectChild: (ast, op) => this.expectChild(ast, op),
        withFrame: (frame, fn) => this.withFrame(frame, fn),
        repository: this.repo(),
      });
    }

    private static lookupClass(name: string, env: Env): CosmClass {
      return InterpreterLookup.lookupClass(name, env, {
        lookupProperty: (receiver, property) => this.lookupProperty(receiver, property),
        classesObject: (scope) => this.classesObject(scope),
        cosmObject: (scope) => this.cosmObject(scope),
        evalNode: (ast, scope) => this.evalNode(ast, scope),
        expectChild: (ast, op) => this.expectChild(ast, op),
        withFrame: (frame, fn) => this.withFrame(frame, fn),
        repository: this.repo(),
      });
    }

    private static classesObject(env: Env): CosmValue {
      return InterpreterRoots.classesObject(env, this.repo());
    }

    private static cosmObject(env: Env): CosmValue {
      return InterpreterRoots.cosmObject(env, this.repo(), version);
    }

    private static evalAccess(ast: CoreNode, env: Env): CosmValue {
      return InterpreterLookup.evalAccess(ast, env, {
        lookupProperty: (receiver, property) => this.lookupProperty(receiver, property),
        classesObject: (scope) => this.classesObject(scope),
        cosmObject: (scope) => this.cosmObject(scope),
        evalNode: (node, scope) => this.evalNode(node, scope),
        expectChild: (node, op) => this.expectChild(node, op),
        withFrame: (frame, fn) => this.withFrame(frame, fn),
        repository: this.repo(),
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
      return InterpreterLookup.evalIvar(ast, env);
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
      return InterpreterMessage.send(receiver, message, args, env, {
        invokeFunction: (callee, invokeArgs, selfValue, scope, currentBlock) => this.invokeFunction(callee, invokeArgs, selfValue, scope, currentBlock),
        withFrame: (frame, fn) => this.withFrame(frame, fn),
        repository: this.repo(),
      });
    }

    private static invokeSend(receiver: CosmValue, messageValue: CosmValue, args: CosmValue[], env?: Env): CosmValue {
      return InterpreterMessage.invokeSend(receiver, messageValue, args, env, {
        invokeFunction: (callee, invokeArgs, selfValue, scope, currentBlock) => this.invokeFunction(callee, invokeArgs, selfValue, scope, currentBlock),
        withFrame: (frame, fn) => this.withFrame(frame, fn),
        repository: this.repo(),
      });
    }

    private static operatorHooks() {
      return {
        evalNode: (node: CoreNode, scope: Env) => this.evalNode(node, scope),
        expectChild: (node: CoreNode, op: string) => this.expectChild(node, op),
        expectChildren: (node: CoreNode, op: string) => this.expectChildren(node, op),
        send: (receiver: CosmValue, message: string, args: CosmValue[], scope?: Env) => this.send(receiver, message, args, scope),
        invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, scope?: Env, currentBlock?: CosmValue) =>
          this.invokeFunction(callee, args, selfValue, scope, currentBlock),
      };
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

    export const version = "0.3.12.4";
}
export default Cosm;
