import * as ohm from 'ohm-js';
import rawGrammar from "./lang/cosm.ohm.txt";
import { CosmValue, CosmClass, CosmEnv, CoreNode, CoreNodeKind, CosmArray, CosmHash, CosmObject, CosmFunction, Types } from './types';

function never(_x: never): never {
  throw new Error("Unexpected value: " + _x);
}

type SurfaceNodeKind =
  | 'program'
  | 'statement_list'
  | 'statement'
  | 'class_stmt'
  | 'def_stmt'
  | 'class_super'
  | 'class_body'
  | 'let_stmt'
  | 'if_expr'
  | 'block_expr'
  | 'lambda_expr'
  | 'number'
  | 'bool'
  | 'string'
  | 'ident'
  | 'list'
  | 'array'
  | 'hash'
  | 'pair'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'pow'
  | 'pos'
  | 'neg'
  | 'not'
  | 'or'
  | 'and'
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'access'
  | 'call';

type SurfaceNode = {
  kind: SurfaceNodeKind;
  value: string;
  children?: SurfaceNode[];
  left?: SurfaceNode;
  right?: SurfaceNode;
  params?: string[];
};


namespace Cosm {

  type Repository = {
    globals: Record<string, CosmValue>;
    classes: Record<string, CosmClass>;
  };

  type Env = CosmEnv;

  class Lowerer {
    static lower(node: SurfaceNode): CoreNode {
      switch (node.kind) {
        case 'program':
          return {
            kind: 'program',
            value: '',
            children: this.lowerProgramChildren(node),
          };
        case 'statement_list':
          return { kind: 'block', value: '', children: this.lowerChildren(node) };
        case 'statement':
          if (!node.left) {
            throw new Error('Invalid surface AST: statement node must wrap a child');
          }
          return this.lower(node.left);
        case 'class_stmt':
          return {
            kind: 'class',
            value: node.value,
            left: node.left ? this.lower(node.left) : undefined,
            children: this.lowerChildren(node),
          };
        case 'def_stmt':
          return {
            kind: 'def',
            value: node.value,
            params: node.params ?? [],
            children: this.lowerChildren(node),
          };
        case 'let_stmt':
          return {
            kind: 'let',
            value: node.value,
            left: this.lowerRequired(node.left, 'let_stmt'),
          };
        case 'class_super':
          return {
            kind: 'ident',
            value: node.value,
          };
        case 'if_expr':
          return {
            kind: 'if',
            value: '',
            left: this.lowerRequired(node.left, 'if_expr'),
            children: this.lowerChildren(node),
          };
        case 'block_expr':
          return {
            kind: 'block',
            value: '',
            children: this.lowerChildren(node),
          };
        case 'lambda_expr':
          return {
            kind: 'lambda',
            value: '<lambda>',
            params: node.params ?? [],
            children: this.lowerChildren(node),
          };
        case 'number':
        case 'bool':
        case 'string':
        case 'ident':
        case 'add':
        case 'subtract':
        case 'multiply':
        case 'divide':
        case 'pow':
        case 'pos':
        case 'neg':
        case 'not':
        case 'or':
        case 'and':
        case 'eq':
        case 'neq':
        case 'lt':
        case 'lte':
        case 'gt':
        case 'gte':
        case 'access':
        case 'call':
        case 'array':
        case 'hash':
        case 'pair':
          return {
            kind: node.kind as CoreNodeKind,
            value: node.value,
            params: node.params,
            left: node.left ? this.lower(node.left) : undefined,
            right: node.right ? this.lower(node.right) : undefined,
            children: node.children?.map((child) => this.lower(child)),
          };
        case 'list':
        case 'class_body':
          throw new Error('Invalid surface AST: list nodes must be lowered by their parent');
      }
    }

    private static lowerChildren(node: SurfaceNode): CoreNode[] {
      return (node.children ?? []).map((child) => this.lower(child));
    }

    private static lowerProgramChildren(node: SurfaceNode): CoreNode[] {
      const [statementList] = node.children ?? [];
      if (!statementList) {
        return [];
      }
      if (statementList.kind !== 'statement_list') {
        throw new Error('Invalid surface AST: program must contain a statement list');
      }
      return this.lowerChildren(statementList);
    }

    private static lowerRequired(node: SurfaceNode | undefined, kind: string): CoreNode {
      if (!node) {
        throw new Error(`Invalid surface AST: ${kind} is missing a required child`);
      }
      return this.lower(node);
    }
  }

  export class Parser {
    private static listChildren(node: SurfaceNode): SurfaceNode[] {
      const children = node.children ?? [];
      if (children[0]?.kind === 'list') {
        return children[0].children ?? [];
      }
      return children;
    }

    private static paramNames(node: SurfaceNode): string[] {
      return this.listChildren(node).map((param) => param.value);
    }

    static parseSurface(input: string): SurfaceNode {
      const grammar = ohm.grammar(rawGrammar);
      const semantics = grammar.createSemantics().addOperation('ast', {
        _iter(...children) {
          return {
            kind: 'list',
            value: '',
            children: children.map((child) => child.ast()),
          };
        },
        Program: (statements) => ({
          kind: 'program',
          value: '',
          children: [statements.ast()],
        }),
        StatementList: (first, rest, _trailing) => ({
          kind: 'statement_list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        StatementTail: (_sep, statement) => statement.ast(),
        Statement: (statement) => ({
          kind: 'statement',
          value: '',
          left: statement.ast(),
        }),
        ClassStmt: (_class, name, superclass, _do, body, _end) => {
          const superclassNode = superclass.ast();
          return {
            kind: 'class_stmt',
            value: name.sourceString,
            left: superclassNode.kind === 'list' ? superclassNode.children?.[0] : superclassNode,
            children: Parser.listChildren(body.ast()),
          };
        },
        ClassSuper: (_open, name, _close) => ({
          kind: 'class_super',
          value: name.sourceString,
        }),
        ClassBody: (members) => ({
          kind: 'class_body',
          value: '',
          children: members.children.map((child) => child.ast()),
        }),
        ClassMember: (member, _semi) => member.ast(),
        DefStmt: (_def, name, _open, params, _close, _do, body, _end) => ({
          kind: 'def_stmt',
          value: name.sourceString,
          params: Parser.paramNames(params.ast()),
          children: [{ kind: 'block_expr', value: '', children: Parser.listChildren(body.ast()) }],
        }),
        LetStmt: (_let, name, _eq, expr) => ({
          kind: 'let_stmt',
          value: name.sourceString,
          left: expr.ast(),
        }),
        Exp: (exp) => exp.ast(),
        IfExp_full: (_if, condition, _then, thenBody, _else, elseBody, _end) => ({
          kind: 'if_expr',
          value: '',
          left: condition.ast(),
          children: [
            { kind: 'block_expr', value: '', children: Parser.listChildren(thenBody.ast()) },
            { kind: 'block_expr', value: '', children: Parser.listChildren(elseBody.ast()) },
          ],
        }),
        PriExp_block: (_do, body, _end) => ({
          kind: 'block_expr',
          value: '',
          children: Parser.listChildren(body.ast()),
        }),
        PriExp_lambda: (_arrow, _open, params, _close, _lbrace, body, _rbrace) => ({
          kind: 'lambda_expr',
          value: '<lambda>',
          params: Parser.paramNames(params.ast()),
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
        }),
        OrExp_or: (left, _op, right) => ({ kind: 'or', value: '', left: left.ast(), right: right.ast() }),
        AndExp_and: (left, _op, right) => ({ kind: 'and', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_eq: (left, _op, right) => ({ kind: 'eq', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_neq: (left, _op, right) => ({ kind: 'neq', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_lt: (left, _op, right) => ({ kind: 'lt', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_lte: (left, _op, right) => ({ kind: 'lte', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_gt: (left, _op, right) => ({ kind: 'gt', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_gte: (left, _op, right) => ({ kind: 'gte', value: '', left: left.ast(), right: right.ast() }),
        AddExp_plus: (left, _op, right) => ({ kind: 'add', value: '', left: left.ast(), right: right.ast() }),
        AddExp_minus: (left, _op, right) => ({ kind: 'subtract', value: '', left: left.ast(), right: right.ast() }),
        MulExp_times: (left, _op, right) => ({ kind: 'multiply', value: '', left: left.ast(), right: right.ast() }),
        MulExp_divide: (left, _op, right) => ({ kind: 'divide', value: '', left: left.ast(), right: right.ast() }),
        ExpExp_power: (left, _op, right) => ({ kind: 'pow', value: '', left: left.ast(), right: right.ast() }),
        UnaryExp_not: (_op, expr) => ({ kind: 'not', value: '', left: expr.ast() }),
        UnaryExp_pos: (_op, expr) => ({ kind: 'pos', value: '', left: expr.ast() }),
        UnaryExp_neg: (_op, expr) => ({ kind: 'neg', value: '', left: expr.ast() }),
        PostExp_access: (left, _dot, property) => ({ kind: 'access', value: property.sourceString, left: left.ast() }),
        PostExp_call: (callee, _open, args, _close) => ({
          kind: 'call',
          value: '',
          left: callee.ast(),
          children: Parser.listChildren(args.ast()),
        }),
        PriExp_paren: (_open, exp, _close) => exp.ast(),
        PriExp_array: (_open, items, _close) => ({
          kind: 'array',
          value: '',
          children: Parser.listChildren(items.ast()),
        }),
        PriExp_hash: (_open, entries, _close) => ({
          kind: 'hash',
          value: '',
          children: Parser.listChildren(entries.ast()),
        }),
        CallArgs: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        ArrayItems: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        HashItems: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        ParamList: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        HashEntry: (key, _colon, value) => ({ kind: 'pair', value: key.sourceString, left: value.ast() }),
        string: (_open, parts, _close) => {
          const children = Parser.listChildren(parts.ast());
          const isPlain = children.every((child) => child.kind === 'string' && !(child.children?.length));
          if (isPlain) {
            return {
              kind: 'string',
              value: children.map((child) => child.value).join(''),
            };
          }
          return {
            kind: 'string',
            value: '',
            children,
          };
        },
        stringPart_interp: (interpolation) => interpolation.ast(),
        stringPart_text: (text) => text.ast(),
        stringPart_escape: (_slash, escape) => escape.ast(),
        interpolation: (_open, expr, _close) => expr.ast(),
        stringText_plain: (char) => ({ kind: 'string', value: char.sourceString }),
        stringText_hash: (hash) => ({ kind: 'string', value: hash.sourceString }),
        escape_quote: (_quote) => ({ kind: 'string', value: '"' }),
        escape_slash: (_slash) => ({ kind: 'string', value: "\\" }),
        escape_newline: (_newline) => ({ kind: 'string', value: "\n" }),
        escape_tab: (_tab) => ({ kind: 'string', value: "\t" }),
        boolean_true: (_value) => ({ kind: 'bool', value: 'true' }),
        boolean_false: (_value) => ({ kind: 'bool', value: 'false' }),
        number_whole: (digits) => ({ kind: 'number', value: digits.sourceString }),
        number_fract: (whole, _dot, fraction) => ({
          kind: 'number',
          value: `${whole.sourceString}.${fraction.sourceString}`,
        }),
        ident: (_fst, chars) => ({ kind: 'ident', value: _fst.sourceString + chars.sourceString }),
      });

      const matchResult = grammar.match(input);
      if (matchResult.succeeded()) {
        return semantics(matchResult).ast();
      }
      throw new Error("Parse error: " + matchResult.message);
    }

    static parse(input: string): CoreNode {
      return Lowerer.lower(this.parseSurface(input));
    }
  }

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
          return Types.number(Number(ast.value));
        case 'bool':
          return Types.bool(ast.value === 'true');
        case 'string':
          if (!ast.children?.length) {
            return Types.string(ast.value);
          }
          return Types.string(
            ast.children.map((child) => this.coerceToString(this.evalNode(child, env), 'interpolate')).join(''),
          );
        case 'ident':
          return this.lookupName(ast.value, env);
        case 'array':
          return Types.array((ast.children ?? []).map((child) => this.evalNode(child, env)));
        case 'hash':
          return Types.hash(
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
          return Types.number(left - right);
        }
        case 'multiply': {
          const [left, right] = this.evalBinary(ast, 'multiply', env);
          return Types.number(left * right);
        }
        case 'divide': {
          const [left, right] = this.evalBinary(ast, 'divide', env);
          return Types.number(left / right);
        }
        case 'pow': {
          const [left, right] = this.evalBinary(ast, 'pow', env);
          return Types.number(left ** right);
        }
        case 'pos':
          return Types.number(this.evalUnaryNumber(ast, 'pos', env));
        case 'neg':
          return Types.number(-this.evalUnaryNumber(ast, 'neg', env));
        case 'not':
          return Types.bool(!this.evalUnaryBool(ast, 'not', env));
        case 'or': {
          const [left, right] = this.evalBinaryBool(ast, 'or', env);
          return Types.bool(left || right);
        }
        case 'and': {
          const [left, right] = this.evalBinaryBool(ast, 'and', env);
          return Types.bool(left && right);
        }
        case 'eq':
          return Types.bool(this.evalEquality(ast, true, env));
        case 'neq':
          return Types.bool(this.evalEquality(ast, false, env));
        case 'lt': {
          const [left, right] = this.evalBinary(ast, 'lt', env);
          return Types.bool(left < right);
        }
        case 'lte': {
          const [left, right] = this.evalBinary(ast, 'lte', env);
          return Types.bool(left <= right);
        }
        case 'gt': {
          const [left, right] = this.evalBinary(ast, 'gt', env);
          return Types.bool(left > right);
        }
        case 'gte': {
          const [left, right] = this.evalBinary(ast, 'gte', env);
          return Types.bool(left >= right);
        }
        default:
          never(ast);
      }
    }

    private static createRepository(): Repository {
      const objectClass = Types.class('Object');
      const numberClass = Types.class('Number', 'Object', {}, objectClass);
      const booleanClass = Types.class('Boolean', 'Object', {}, objectClass);
      const stringClass = Types.class('String', 'Object', {}, objectClass);
      const arrayClass = Types.class('Array', 'Object', {}, objectClass);
      const hashClass = Types.class('Hash', 'Object', {}, objectClass);
      const functionClass = Types.class('Function', 'Object', {}, objectClass);

      const classes: Record<string, CosmClass> = {
        Object: objectClass,
        Number: numberClass,
        Boolean: booleanClass,
        String: stringClass,
        Array: arrayClass,
        Hash: hashClass,
        Function: functionClass,
      };

      const globals: Record<string, CosmValue> = {
        Object: objectClass,
        Number: numberClass,
        Boolean: booleanClass,
        String: stringClass,
        Array: arrayClass,
        Hash: hashClass,
        Function: functionClass,
      };

      globals.assert = Types.nativeFunc('assert', (args) => {
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
        return Types.bool(true);
      });

      globals.len = Types.nativeFunc('len', (args) => {
        if (args.length !== 1) {
          throw new Error(`Arity error: len expects 1 argument, got ${args.length}`);
        }
        const [value] = args;
        switch (value.type) {
          case 'array':
            return Types.number(value.items.length);
          case 'hash':
            return Types.number(Object.keys(value.entries).length);
          default:
            throw new Error('Type error: len expects an array or hash');
        }
      });

      return { globals, classes };
    }

    static createEnv(parent?: Env): Env {
      return { bindings: {}, parent };
    }

    private static evalStatements(statements: CoreNode[], env: Env): CosmValue {
      let result: CosmValue = Types.bool(true);
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
      const classValue = Types.class(ast.value, superclass.name, methods, superclass);
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
      if (left.type === 'number' && right.type === 'number') {
        return Types.number(left.value + right.value);
      }
      if (left.type === 'string' || right.type === 'string') {
        return Types.string(
          this.coerceToString(left, 'concatenate') + this.coerceToString(right, 'concatenate'),
        );
      }
      throw new Error('Type error: add expects numeric operands or string concatenation');
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
      switch (value.type) {
        case 'string':
          return value.value;
        case 'number':
          return String(value.value);
        case 'bool':
          return String(value.value);
        default:
          if (context === 'interpolate') {
            throw new Error(`Type error: cannot interpolate value of type ${value.type} into a string`);
          }
          throw new Error(`Type error: cannot concatenate value of type ${value.type} into a string`);
      }
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
            && this.valuesEqual(Types.hash(left.fields), Types.hash(rightObject.fields));
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
      return Types.object('Object', classes);
    }

    private static evalAccess(ast: CoreNode, env: Env): CosmValue {
      const receiver = this.evalNode(this.expectChild(ast, 'access'), env);
      return this.lookupProperty(receiver, ast.value);
    }

    private static evalCall(ast: CoreNode, env: Env): CosmValue {
      const calleeAst = this.expectChild(ast, 'call');
      const callee = this.evalNode(calleeAst, env);
      const args = (ast.children ?? []).map((child) => this.evalNode(child, env));
      if (callee.type !== 'function') {
        throw new Error(`Type error: attempted to call a non-function value of type ${callee.type}`);
      }
      if (callee.nativeCall) {
        return callee.nativeCall(args);
      }
      if (!callee.params || !callee.body || !callee.env) {
        throw new Error(`Invalid function: ${callee.name}`);
      }
      if (args.length !== callee.params.length) {
        throw new Error(`Arity error: function expects ${callee.params.length} arguments, got ${args.length}`);
      }
      const callEnv = this.createEnv(callee.env);
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

      switch (receiver.type) {
        case 'array':
          if (property === 'length') {
            return Types.number(receiver.items.length);
          }
          throw new Error(`Property error: Array instance has no property '${property}'`);
        case 'hash': {
          const value = receiver.entries[property];
          if (value === undefined) {
            throw new Error(`Property error: Hash instance has no property '${property}'`);
          }
          return value;
        }
        case 'object': {
          const value = receiver.fields[property];
          if (value === undefined) {
            throw new Error(`Property error: object of class ${receiver.className} has no property '${property}'`);
          }
          return value;
        }
        case 'class':
          if (property === 'name') {
            return Types.string(receiver.name);
          }
          if (property === 'superclass') {
            if (!receiver.superclass) {
              throw new Error(`Property error: class ${receiver.name} has no superclass`);
            }
            return receiver.superclass;
          }
          if (property === 'methods') {
            return Types.object('Object', receiver.methods);
          }
          throw new Error(`Property error: class ${receiver.name} has no property '${property}'`);
        case 'function':
          if (property === 'name') {
            return Types.string(receiver.name);
          }
          throw new Error(`Property error: function ${receiver.name} has no property '${property}'`);
        default: {
          const classValue = this.classOf(receiver);
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
          return this.repository.classes[value.className];
        case 'class':
          return this.repository.classes.Object;
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
      return Types.closure(ast.value, ast.params ?? [], body, env);
    }

    private static collectClassMethods(className: string, children: CoreNode[], env: Env): Record<string, CosmFunction> {
      const methods: Record<string, CosmFunction> = {};
      for (const child of children) {
        if (child.kind !== 'def') {
          throw new Error('Invalid AST: class body currently only supports def members');
        }
        if (Object.hasOwn(methods, child.value)) {
          throw new Error(`Name error: duplicate method '${child.value}' in class '${className}'`);
        }
        methods[child.value] = this.buildClosure(child, env);
      }
      return methods;
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
            methods: Object.keys(value.methods),
          };
        case 'object':
          return Object.fromEntries(
            Object.entries(value.fields).map(([key, entry]) => [key, this.cosmToJS(entry)]),
          );
        case 'function':
          return { kind: 'function', name: value.name };
      }
    }
  }

  export const version = "0.1.0";
}
export default Cosm;
