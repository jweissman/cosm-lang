export type CoreNodeKind =
  | 'program'
  | 'block'
  | 'class'
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
export type CosmObject = {
  type: 'object',
  className: string,
  classRef?: CosmClass,
  fields: Record<string, CosmValue>,
};
export type CosmEnv = { bindings: Record<string, CosmValue>, parent?: CosmEnv };
export type CosmFunction = {
  type: 'function',
  name: string,
  nativeCall?: (args: CosmValue[]) => CosmValue,
  params?: string[],
  body?: CoreNode,
  env?: CosmEnv,
};
export type CosmClass = {
  type: 'class',
  name: string,
  superclassName?: string,
  superclass?: CosmClass,
  methods: Record<string, CosmFunction>,
};

export type CosmValue = CosmNumber
  | CosmBool
  | CosmString
  | CosmArray
  | CosmHash
  | CosmObject
  | CosmClass
  | CosmFunction;

export type SurfaceNodeKind =
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

export type SurfaceNode = {
  kind: SurfaceNodeKind;
  value: string;
  children?: SurfaceNode[];
  left?: SurfaceNode;
  right?: SurfaceNode;
  params?: string[];
};
