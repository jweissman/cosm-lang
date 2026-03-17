import * as ohm from 'ohm-js';
import rawGrammar from "./lang/cosm.ohm.txt";

type CosmNumber = { type: 'number', value: number };
type CosmBool = { type: 'bool', value: boolean };
type CosmString = { type: 'string', value: string };
type CosmArray = { type: 'array', items: CosmValue[] };
type CosmHash = { type: 'hash', entries: Record<string, CosmValue> };
type CosmObject = { type: 'object', className: string, fields: Record<string, CosmValue> };
type CosmClass = { type: 'class', name: string, superclassName?: string };
type CosmFunction = {
  type: 'function',
  name: string,
  call: (args: CosmValue[]) => CosmValue,
};
type CosmValue = CosmNumber
  | CosmBool
  | CosmString
  | CosmArray
  | CosmHash
  | CosmObject
  | CosmClass
  | CosmFunction;

namespace Cosm {
  export class Types {
    static number(value: number): CosmNumber { return { type: 'number', value }; }
    static bool(value: boolean): CosmBool { return { type: 'bool', value }; }
    static string(value: string): CosmString { return { type: 'string', value }; }
    static array(items: CosmValue[]): CosmArray { return { type: 'array', items }; }
    static hash(entries: Record<string, CosmValue>): CosmHash { return { type: 'hash', entries }; }
    static object(className: string, fields: Record<string, CosmValue>): CosmObject {
      return { type: 'object', className, fields };
    }
    static class(name: string, superclassName?: string): CosmClass {
      return { type: 'class', name, superclassName };
    }
    static func(name: string, call: (args: CosmValue[]) => CosmValue): CosmFunction {
      return { type: 'function', name, call };
    }
  }

  type ASTNodeKind =
    | 'program'
    | 'let'
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

  type AST = {
    kind: ASTNodeKind;
    value: string;
    children?: AST[];
    left?: AST;
    right?: AST;
  };

  type Repository = {
    globals: Record<string, CosmValue>;
    classes: Record<string, CosmClass>;
  };

  type Env = Record<string, CosmValue>;

  export class Parser {
    static grammar = ohm.grammar(rawGrammar);
    static semantics = this.grammar.createSemantics().addOperation('ast', {
      _iter(...children) {
        return {
          kind: 'list',
          value: '',
          children: children.map((child) => child.ast()),
        };
      },
      Program: (first, rest, _trailing) => ({
        kind: 'program',
        value: '',
        children: [first.ast(), ...rest.children.map((child) => child.ast())],
      }),
      StatementTail: (_sep, statement) => statement.ast(),
      Statement: (statement) => statement.ast(),
      LetStmt: (_let, name, _eq, expr) => ({
        kind: 'let',
        value: name.sourceString,
        left: expr.ast(),
      }),
      Exp: (exp) => exp.ast(),
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
      PostExp_call: (callee, _open, args, _close) => {
        const list = args.ast();
        const children = list.children?.[0]?.kind === 'list'
          ? list.children[0].children ?? []
          : list.children ?? [];
        return { kind: 'call', value: '', left: callee.ast(), children };
      },
      PriExp_paren: (_open, exp, _close) => exp.ast(),
      PriExp_array: (_open, items, _close) => {
        const list = items.ast();
        const children = list.children?.[0]?.kind === 'list'
          ? list.children[0].children ?? []
          : list.children ?? [];
        return { kind: 'array', value: '', children };
      },
      PriExp_hash: (_open, entries, _close) => {
        const list = entries.ast();
        const children = list.children?.[0]?.kind === 'list'
          ? list.children[0].children ?? []
          : list.children ?? [];
        return { kind: 'hash', value: '', children };
      },
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
      HashEntry: (key, _colon, value) => ({ kind: 'pair', value: key.sourceString, left: value.ast() }),
      string: (_open, chars, _close) => ({
        kind: 'string',
        value: chars.children.map((child) => child.ast().value).join(''),
      }),
      stringChar_plain: (char) => ({ kind: 'string', value: char.sourceString }),
      stringChar_escape: (_slash, escape) => escape.ast(),
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

    static parse(input: string): AST {
      const matchResult = this.grammar.match(input);
      if (matchResult.succeeded()) {
        return this.semantics(matchResult).ast();
      }
      throw new Error("Parse error: " + matchResult.message);
    }
  }

  export class Interpreter {
    private static readonly repository = this.createRepository();

    static evalNode(ast: AST, env: Env): CosmValue {
      switch (ast.kind) {
        case 'program':
          return this.evalProgramNode(ast, env);
        case 'let':
          return this.evalLet(ast, env);
        case 'number':
          return Types.number(Number(ast.value));
        case 'bool':
          return Types.bool(ast.value === 'true');
        case 'string':
          return Types.string(ast.value);
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
        case 'add': {
          return this.evalAdd(ast, env);
        }
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
          throw new Error("Unknown AST node kind: " + ast.kind);
      }
    }

    private static evalProgramNode(ast: AST, env: Env): CosmValue {
      const expressions = ast.children ?? [];
      let result: CosmValue = Types.bool(true);
      for (const expression of expressions) {
        result = this.evalNode(expression, env);
      }
      return result;
    }

    private static evalLet(ast: AST, env: Env): CosmValue {
      if (Object.hasOwn(env, ast.value)) {
        throw new Error(`Name error: duplicate local '${ast.value}'`);
      }
      if (!ast.left) {
        throw new Error("Invalid AST: let node must have a value expression");
      }
      const value = this.evalNode(ast.left, env);
      env[ast.value] = value;
      return value;
    }

    private static createRepository(): Repository {
      const objectClass = Types.class('Object');
      const numberClass = Types.class('Number', 'Object');
      const booleanClass = Types.class('Boolean', 'Object');
      const stringClass = Types.class('String', 'Object');
      const arrayClass = Types.class('Array', 'Object');
      const hashClass = Types.class('Hash', 'Object');
      const functionClass = Types.class('Function', 'Object');

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

      globals.assert = Types.func('assert', (args) => {
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

      globals.len = Types.func('len', (args) => {
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

      globals.classes = Types.object('Object', classes);

      return { globals, classes };
    }

    private static expectChildren(ast: AST, op: string): [AST, AST] {
      if (!ast.left || !ast.right) {
        throw new Error(`Invalid AST: ${op} node must have left and right children`);
      }
      return [ast.left, ast.right];
    }

    private static expectChild(ast: AST, op: string): AST {
      if (!ast.left) {
        throw new Error(`Invalid AST: ${op} node must have one child`);
      }
      return ast.left;
    }

    private static evalBinary(ast: AST, op: string, env: Env): [number, number] {
      const [leftAst, rightAst] = this.expectChildren(ast, op);
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      if (left.type !== 'number' || right.type !== 'number') {
        throw new Error(`Type error: ${op} expects numeric operands`);
      }
      return [left.value, right.value];
    }

    private static evalAdd(ast: AST, env: Env): CosmValue {
      const [leftAst, rightAst] = this.expectChildren(ast, 'add');
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      if (left.type === 'number' && right.type === 'number') {
        return Types.number(left.value + right.value);
      }
      if (left.type === 'string' || right.type === 'string') {
        return Types.string(this.coerceToString(left) + this.coerceToString(right));
      }
      throw new Error('Type error: add expects numeric operands or string concatenation');
    }

    private static evalBinaryBool(ast: AST, op: string, env: Env): [boolean, boolean] {
      const [leftAst, rightAst] = this.expectChildren(ast, op);
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      if (left.type !== 'bool' || right.type !== 'bool') {
        throw new Error(`Type error: ${op} expects boolean operands`);
      }
      return [left.value, right.value];
    }

    private static evalUnaryNumber(ast: AST, op: string, env: Env): number {
      const child = this.evalNode(this.expectChild(ast, op), env);
      if (child.type !== 'number') {
        throw new Error(`Type error: ${op} expects a numeric operand`);
      }
      return child.value;
    }

    private static evalUnaryBool(ast: AST, op: string, env: Env): boolean {
      const child = this.evalNode(this.expectChild(ast, op), env);
      if (child.type !== 'bool') {
        throw new Error(`Type error: ${op} expects a boolean operand`);
      }
      return child.value;
    }

    private static evalEquality(ast: AST, shouldEqual: boolean, env: Env): boolean {
      const [leftAst, rightAst] = this.expectChildren(ast, shouldEqual ? 'eq' : 'neq');
      const left = this.evalNode(leftAst, env);
      const right = this.evalNode(rightAst, env);
      return shouldEqual ? this.valuesEqual(left, right) : !this.valuesEqual(left, right);
    }

    private static coerceToString(value: CosmValue): string {
      switch (value.type) {
        case 'string':
          return value.value;
        case 'number':
          return String(value.value);
        case 'bool':
          return String(value.value);
        default:
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
          return left.name === (right as CosmFunction).name;
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
      const localValue = env[name];
      if (localValue !== undefined) {
        return localValue;
      }
      const value = this.repository.globals[name];
      if (value === undefined) {
        throw new Error(`Name error: unknown identifier '${name}'`);
      }
      return value;
    }

    private static evalAccess(ast: AST, env: Env): CosmValue {
      const receiver = this.evalNode(this.expectChild(ast, 'access'), env);
      return this.lookupProperty(receiver, ast.value);
    }

    private static evalCall(ast: AST, env: Env): CosmValue {
      const calleeAst = this.expectChild(ast, 'call');
      const callee = this.evalNode(calleeAst, env);
      const args = (ast.children ?? []).map((child) => this.evalNode(child, env));
      if (callee.type !== 'function') {
        throw new Error(`Type error: attempted to call a non-function value of type ${callee.type}`);
      }
      return callee.call(args);
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
            if (!receiver.superclassName) {
              throw new Error(`Property error: class ${receiver.name} has no superclass`);
            }
            return this.repository.classes[receiver.superclassName];
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

    static eval(input: string): CosmValue {
      return this.evalNode(Parser.parse(input), {});
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
          return { kind: 'class', name: value.name, superclassName: value.superclassName };
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
