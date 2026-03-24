import { CosmValue, CosmClass, CosmEnv, CoreNode, CosmObject, CosmFunction } from './types';
import { Construct } from "./Construct";
import { Parser } from './ast/parser';
import { RuntimeDispatch } from './runtime/RuntimeDispatch';
import { Bootstrap } from './runtime/Bootstrap';
import { CosmHttpRouterValue } from './values/CosmHttpRouterValue';
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CosmModuleValue } from './values/CosmModuleValue';
import { CosmErrorValue } from './values/CosmErrorValue';
import { CosmRaisedError } from './runtime/CosmRaisedError';
import { CosmSessionValue } from './values/CosmSessionValue';

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
      const repository = Bootstrap.createRepository({
        invokeFunction: (callee, args, selfValue, env) => this.invokeFunction(callee, args, selfValue, env),
        instantiateClass: (classValue, args) => this.instantiateClass(classValue, args),
        invokeSend: (receiver, messageValue, args, env) => this.invokeSend(receiver, messageValue, args, env),
        classOf: (value) => this.classOf(value),
        internSymbol: (name) => this.internSymbol(name),
        loadModule: (name, env) => this.loadModule(name, env),
        evalSource: (source) => this.evalSharedKernelSource(source),
        evalInEnv: (source, env) => this.evalInEnv(source, env),
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
      return this.loadModuleIntoRepository(name, this.repo());
    }

    private static preloadStdlibModules(repository: Repository): void {
      for (const name of ["cosm/ai.cosm"]) {
        const loaded = this.loadModuleIntoRepository(name, repository);
        if (loaded) {
          repository.modules[name] = loaded;
          repository.modules[name.replace(/\.cosm$/u, "")] = loaded;
        }
      }
    }

    private static loadModuleIntoRepository(name: string, repository: Repository): CosmObject | undefined {
      if (!name.endsWith(".cosm")) {
        if (!name.endsWith(".ecosm")) {
          return undefined;
        }
        const cachedTemplate = repository.modules[name];
        if (cachedTemplate instanceof CosmModuleValue) {
          return cachedTemplate;
        }
        const source = readFileSync(resolve(process.cwd(), name), "utf8");
        const templateModule = Construct.module(name, {
          source: Construct.string(source),
          render: Construct.nativeFunc("render", (args) => {
            if (args.length > 2) {
              throw new Error(`Arity error: render expects 0, 1, or 2 arguments, got ${args.length}`);
            }
            const [context, body] = args;
            return this.renderTemplateSource(source, context, body);
          }),
        }, repository.classes.Module);
        repository.modules[name] = templateModule;
        return templateModule;
      }
      const cachedModule = repository.modules[name];
      if (cachedModule instanceof CosmModuleValue) {
        return cachedModule;
      }
      const source = readFileSync(resolve(process.cwd(), name), "utf8");
      const moduleEnv = this.createEnv();
      this.evalInEnv(source, moduleEnv);
      const loadedModule = Construct.module(name, { ...moduleEnv.bindings }, repository.classes.Module);
      repository.modules[name] = loadedModule;
      return loadedModule;
    }

    private static renderTemplateSource(source: string, context?: CosmValue, body?: CosmValue): CosmValue {
      const env = this.createTemplateEnv(context, body);
      let output = '';
      let cursor = 0;

      while (cursor < source.length) {
        const nextHashInterpolation = source.indexOf('#{', cursor);
        const nextErbInterpolation = source.indexOf('<%=', cursor);
        const interpolationStart = this.nextTemplateInterpolation(nextHashInterpolation, nextErbInterpolation);
        if (interpolationStart === -1) {
          output += source.slice(cursor);
          break;
        }
        output += source.slice(cursor, interpolationStart);
        if (source.startsWith('#{', interpolationStart)) {
          const interpolationEnd = this.findTemplateExpressionEnd(source, interpolationStart + 2);
          const expression = source.slice(interpolationStart + 2, interpolationEnd).trim();
          const value = expression.length === 0
            ? Construct.string("")
            : this.evalInEnv(expression, env);
          output += value.toCosmString('interpolate');
          cursor = interpolationEnd + 1;
          continue;
        }
        const interpolationEnd = this.findTemplateTagEnd(source, interpolationStart + 3);
        const expression = source.slice(interpolationStart + 3, interpolationEnd).trim();
        const value = expression.length === 0
          ? Construct.string("")
          : this.evalInEnv(expression, env);
        output += value.toCosmString('interpolate');
        cursor = interpolationEnd + 2;
      }

      return Construct.string(output);
    }

    private static nextTemplateInterpolation(hashIndex: number, erbIndex: number): number {
      if (hashIndex === -1) {
        return erbIndex;
      }
      if (erbIndex === -1) {
        return hashIndex;
      }
      return Math.min(hashIndex, erbIndex);
    }

    private static createTemplateEnv(context?: CosmValue, body?: CosmValue): Env {
      const env = this.createEnv();
      if (body !== undefined) {
        env.currentBlock = Construct.nativeFunc('<template yield>', (args) => {
          if (args.length !== 0) {
            throw new Error(`Arity error: template yield expects 0 arguments, got ${args.length}`);
          }
          return body;
        });
      }
      if (!context) {
        return env;
      }
      env.bindings.context = context;
      switch (context.type) {
        case 'hash': {
          Object.assign(env.bindings, context.entries);
          break;
        }
        case 'object': {
          Object.assign(env.bindings, context.fields);
          break;
        }
      }
      return env;
    }

    private static findTemplateExpressionEnd(source: string, startIndex: number): number {
      let index = startIndex;
      let depth = 1;
      let inSingle = false;
      let inDouble = false;
      let inTripleDouble = false;
      let escaped = false;

      while (index < source.length) {
        const nextThree = source.slice(index, index + 3);
        const char = source[index];

        if (inTripleDouble) {
          if (nextThree === '"""') {
            inTripleDouble = false;
            index += 3;
            continue;
          }
          index += 1;
          continue;
        }

        if (inSingle || inDouble) {
          if (escaped) {
            escaped = false;
            index += 1;
            continue;
          }
          if (char === '\\') {
            escaped = true;
            index += 1;
            continue;
          }
          if (inSingle && char === '\'') {
            inSingle = false;
          } else if (inDouble && char === '"') {
            inDouble = false;
          }
          index += 1;
          continue;
        }

        if (nextThree === '"""') {
          inTripleDouble = true;
          index += 3;
          continue;
        }
        if (char === '\'') {
          inSingle = true;
          index += 1;
          continue;
        }
        if (char === '"') {
          inDouble = true;
          index += 1;
          continue;
        }
        if (source.slice(index, index + 2) === '#{') {
          depth += 1;
          index += 2;
          continue;
        }
        if (char === '}') {
          depth -= 1;
          if (depth === 0) {
            return index;
          }
        }
        index += 1;
      }

      throw new Error("Template parse error: missing closing } for interpolation");
    }

    private static findTemplateTagEnd(source: string, startIndex: number): number {
      let index = startIndex;
      let inSingle = false;
      let inDouble = false;
      let inTripleDouble = false;
      let escaped = false;

      while (index < source.length) {
        const nextThree = source.slice(index, index + 3);
        const nextTwo = source.slice(index, index + 2);
        const char = source[index];

        if (inTripleDouble) {
          if (nextThree === '"""') {
            inTripleDouble = false;
            index += 3;
            continue;
          }
          index += 1;
          continue;
        }

        if (inSingle || inDouble) {
          if (escaped) {
            escaped = false;
            index += 1;
            continue;
          }
          if (char === '\\') {
            escaped = true;
            index += 1;
            continue;
          }
          if (inSingle && char === '\'') {
            inSingle = false;
          } else if (inDouble && char === '"') {
            inDouble = false;
          }
          index += 1;
          continue;
        }

        if (nextThree === '"""') {
          inTripleDouble = true;
          index += 3;
          continue;
        }
        if (char === '\'') {
          inSingle = true;
          index += 1;
          continue;
        }
        if (char === '"') {
          inDouble = true;
          index += 1;
          continue;
        }
        if (nextTwo === '%>') {
          return index;
        }
        index += 1;
      }

      throw new Error("Template parse error: missing closing %> for interpolation");
    }

    private static evalClass(ast: CoreNode, env: Env): CosmValue {
      if (Object.hasOwn(env.bindings, ast.value) && !env.allowTopLevelRebinds) {
        throw new Error(`Name error: duplicate local '${ast.value}'`);
      }
      const superclassName = ast.left?.value || 'Object';
      const superclass = this.lookupClass(superclassName, env);
      const methods = this.collectClassMethods(ast.value, ast.children ?? [], env);
      const classMethods = this.collectClassMethods(ast.value, ast.children ?? [], env, 'class_def');
      const slots = this.collectClassSlots(ast.value, methods, superclass);
      const metaclass = Bootstrap.createMetaclass(ast.value, superclass.classRef ?? this.repo().classes.Class, classMethods, this.repo().classes.Class);
      const classValue = Construct.class(ast.value, superclass.name, slots, methods, classMethods, superclass, metaclass);
      env.bindings[ast.value] = classValue;
      return classValue;
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
      const classes = { ...this.repo().classes };
      for (let scope: Env | undefined = env; scope; scope = scope.parent) {
        for (const [name, value] of Object.entries(scope.bindings)) {
          if (value.type === 'class') {
            classes[name] = value;
          }
        }
      }
      return Construct.namespace(classes, this.repo().classes.Namespace);
    }

    private static cosmObject(env: Env): CosmValue {
      const moduleEntries = Object.fromEntries(
        Object.entries(this.repo().modules)
          .filter(([name]) => name.startsWith("cosm/") && !name.endsWith(".ecosm"))
          .map(([name, value]) => {
            const key = name
              .replace(/^cosm\//u, "")
              .replace(/\.(cosm)$/u, "")
              .split("/")
              .at(-1) as string;
            return [key, value];
          }),
      );
      return Construct.namespace({
        Kernel: this.repo().globals.Kernel,
        Process: this.repo().globals.Process,
        Time: this.repo().globals.Time,
        Random: this.repo().globals.Random,
        Mirror: this.repo().globals.Mirror,
        Error: this.repo().globals.Error,
        Schema: this.repo().globals.Schema,
        Prompt: this.repo().globals.Prompt,
        Session: this.repo().globals.Session,
        Data: this.repo().globals.Data,
        HttpRouter: this.repo().globals.HttpRouter,
        ai: this.repo().globals.ai,
        http: this.repo().globals.http,
        modules: Construct.namespace(moduleEntries, this.repo().classes.Namespace),
        classes: this.classesObject(env),
        test: this.repo().modules["cosm/test"],
        version: Construct.string(version),
      }, this.repo().classes.Namespace);
    }

    private static evalAccess(ast: CoreNode, env: Env): CosmValue {
      return this.withFrame(`access ${this.describeCallTarget(ast)}`, () => {
        const receiver = this.evalNode(this.expectChild(ast, 'access'), env);
        return this.lookupProperty(receiver, ast.value);
      });
    }

    private static evalCall(ast: CoreNode, env: Env): CosmValue {
      const calleeAst = this.expectChild(ast, 'call');
      return this.withFrame(`call ${this.describeCallTarget(calleeAst)}`, () => {
        const blockArg = ast.target === 'trailing_block' ? (ast.children ?? []).at(-1) : undefined;
        const currentBlock = blockArg ? this.evalNode(blockArg, env) : undefined;
        const args = (ast.children ?? []).map((child) => child === blockArg && currentBlock ? currentBlock : this.evalNode(child, env));
        if (calleeAst.kind === 'access') {
          const receiver = this.evalNode(this.expectChild(calleeAst, 'access'), env);
          try {
            const callee = this.lookupProperty(receiver, calleeAst.value);
            if (callee.type !== 'function' && callee.type !== 'method') {
              if (receiver.type === 'class') {
                const nativeMethod = receiver.nativeMethod(calleeAst.value);
                if (nativeMethod) {
                  return this.invokeFunction(RuntimeDispatch.bindMethod(receiver, nativeMethod), args, undefined, env, currentBlock);
                }
              }
              return this.send(receiver, calleeAst.value, args, env);
            }
            return this.invokeFunction(callee, args, undefined, env, currentBlock);
          } catch (error) {
            if (
              receiver.type !== 'class'
              && error instanceof Error
              && error.message.includes(`has no property '${calleeAst.value}'`)
            ) {
              return this.send(receiver, calleeAst.value, args, env);
            }
            if (
              error instanceof Error
              && error.message === `Type error: attempted to call a non-function value of type object`
            ) {
              return this.send(receiver, calleeAst.value, args, env);
            }
            throw error;
          }
        }
        if (calleeAst.kind === 'ident') {
          try {
            const callee = this.lookupName(calleeAst.value, env);
            return this.invokeFunction(callee, args, undefined, env, currentBlock);
          } catch (error) {
            const selfValue = this.findSelfBinding(env);
            if (selfValue && error instanceof Error && error.message === `Name error: unknown identifier '${calleeAst.value}'`) {
              return this.send(selfValue, calleeAst.value, args, env);
            }
            throw error;
          }
        }
        const callee = this.evalNode(calleeAst, env);
        return this.invokeFunction(callee, args, undefined, env, currentBlock);
      });
    }

    private static evalYield(ast: CoreNode, env: Env): CosmValue {
      const currentBlock = this.findCurrentBlock(env);
      if (!currentBlock) {
        throw new Error('Block error: yield called without a current block');
      }
      const args = (ast.children ?? []).map((child) => this.evalNode(child, env));
      return this.withFrame('yield', () => this.invokeFunction(currentBlock, args, undefined, env));
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
      return this.withFrame(`invoke ${this.describeCallable(callee, selfValue)}`, () => {
        const activeBlock = currentBlock ?? (env ? this.findCurrentBlock(env) : undefined);
        if (callee.type === 'method') {
          return this.invokeFunction(callee.target, args, callee.receiver, env, activeBlock);
        }
        if (callee.type !== 'function') {
          throw new Error(`Type error: attempted to call a non-function value of type ${callee.type}`);
        }
        if (callee.nativeCall) {
          return callee.nativeCall(args, selfValue, env);
        }
        if (!callee.params || !callee.body || !callee.env) {
          throw new Error(`Invalid function: ${callee.name}`);
        }
        const effectiveArgs = activeBlock
          && args.length === (callee.params.length + 1)
          && args.at(-1) === activeBlock
          ? args.slice(0, -1)
          : args;
        if (effectiveArgs.length !== callee.params.length) {
          throw new Error(`Arity error: function expects ${callee.params.length} arguments, got ${effectiveArgs.length}`);
        }
        const callEnv = this.createEnv(callee.env);
        callEnv.currentBlock = activeBlock;
        if (selfValue) {
          callEnv.bindings.self = selfValue;
        }
        for (const [index, param] of callee.params.entries()) {
          if (Object.hasOwn(callEnv.bindings, param)) {
            throw new Error(`Name error: duplicate parameter '${param}'`);
          }
          callEnv.bindings[param] = effectiveArgs[index];
        }
        return this.evalStatements(callee.body.children ?? [], callEnv);
      });
    }

    private static lookupProperty(receiver: CosmValue, property: string): CosmValue {
      return RuntimeDispatch.lookupProperty(receiver, property, this.repo());
    }

    private static classOf(value: CosmValue): CosmClass {
      return RuntimeDispatch.classOf(value, this.repo().classes);
    }

    static evalInEnv(input: string, env: Env): CosmValue {
      return this.withFrame('eval <input>', () => this.evalNode(Parser.parse(input), env));
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
      if (classValue.name === 'HttpRouter') {
        return new CosmHttpRouterValue({}, classValue, this.repo().classes.HttpResponse, this.repo().classes.Namespace);
      }
      if (classValue.name === 'Session') {
        return new CosmSessionValue(undefined, classValue, this.repo().classes.Error);
      }
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

    private static instantiateClass(classValue: CosmClass, args: CosmValue[]): CosmObject {
      if (args.length !== classValue.slots.length) {
        throw new Error(`Arity error: ${classValue.name}.new expects ${classValue.slots.length} arguments, got ${args.length}`);
      }
      const instance = this.buildInstance(classValue, args);
      this.invokeInitializerChain(classValue, instance, args);
      return instance;
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

    private static describeCallTarget(ast: CoreNode): string {
      if (ast.kind === 'ident') {
        return ast.value;
      }
      if (ast.kind === 'access') {
        return `${this.describeCallTarget(this.expectChild(ast, 'access'))}.${ast.value}`;
      }
      if (ast.kind === 'call') {
        return this.describeCallTarget(this.expectChild(ast, 'call'));
      }
      return `<${ast.kind}>`;
    }

    private static describeCallable(callee: CosmValue, selfValue?: CosmValue): string {
      if (callee.type === 'method') {
        return `${this.describeValue(callee.receiver)}.${callee.name}`;
      }
      if (callee.type === 'function') {
        if (selfValue) {
          return `${this.describeValue(selfValue)}.${callee.name}`;
        }
        return callee.name;
      }
      return callee.type;
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

    export const version = "0.3.8";
}
export default Cosm;
