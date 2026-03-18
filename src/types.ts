export type CoreNodeKind =
  | 'program'
  | 'block'
  | 'let'
  | 'def'
  | 'if'
  | 'lambda'
  | 'number'
  | 'bool'
  | 'string'
  | 'ident'
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

export type CoreNode = {
  kind: CoreNodeKind;
  value: string;
  children?: CoreNode[];
  left?: CoreNode;
  right?: CoreNode;
  params?: string[];
};

export type CosmNumber = { type: 'number', value: number };
export type CosmBool = { type: 'bool', value: boolean };
export type CosmString = { type: 'string', value: string };
export type CosmArray = { type: 'array', items: CosmValue[] };
export type CosmHash = { type: 'hash', entries: Record<string, CosmValue> };
export type CosmObject = { type: 'object', className: string, fields: Record<string, CosmValue> };
export type CosmClass = { type: 'class', name: string, superclassName?: string };
export type CosmEnv = { bindings: Record<string, CosmValue>, parent?: CosmEnv };
export type CosmFunction = {
  type: 'function',
  name: string,
  nativeCall?: (args: CosmValue[]) => CosmValue,
  params?: string[],
  body?: CoreNode,
  env?: CosmEnv,
};

export type CosmValue = CosmNumber
  | CosmBool
  | CosmString
  | CosmArray
  | CosmHash
  | CosmObject
  | CosmClass
  | CosmFunction;

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
    static nativeFunc(name: string, nativeCall: (args: CosmValue[]) => CosmValue): CosmFunction {
      return { type: 'function', name, nativeCall };
    }
    static closure(name: string, params: string[], body: CoreNode, env: CosmEnv): CosmFunction {
      return { type: 'function', name, params, body, env };
    }
  }