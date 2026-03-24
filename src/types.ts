import { CosmNumberValue } from "./values/CosmNumberValue";
import { CosmSymbolValue } from "./values/CosmSymbolValue";
import { CosmMethodValue } from "./values/CosmMethodValue";
import { CosmBoolValue } from "./values/CosmBoolValue";
import { CosmStringValue } from "./values/CosmStringValue";
import { CosmArrayValue } from "./values/CosmArrayValue";
import { CosmHashValue } from "./values/CosmHashValue";
import { CosmFunctionValue } from "./values/CosmFunctionValue";
import { CosmClassValue } from "./values/CosmClassValue";
import { CosmObjectValue } from "./values/CosmObjectValue";
import { CosmHttpRouterValue } from "./values/CosmHttpRouterValue";
import { CosmMirrorValue } from "./values/CosmMirrorValue";
import { CosmErrorValue } from "./values/CosmErrorValue";
import { CosmSchemaValue } from "./values/CosmSchemaValue";
import { CosmPromptValue } from "./values/CosmPromptValue";
import { CosmAiValue } from "./values/CosmAiValue";
import { CosmSessionValue } from "./values/CosmSessionValue";

export type CoreNodeKind =
  | 'program'
  | 'block'
  | 'class'
  | 'class_meta'
  | 'let'
  | 'require'
  | 'def'
  | 'class_def'
  | 'if'
  | 'lambda'
  | 'number'
  | 'bool'
  | 'string'
  | 'symbol'
  | 'ident'
  | 'ivar'
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
  | 'semantic_eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'access'
  | 'call'
  | 'yield';

export type CoreNode = {
  kind: CoreNodeKind;
  value: string;
  children?: CoreNode[];
  left?: CoreNode;
  right?: CoreNode;
  params?: string[];
  target?: string;
};

export type CosmEnv = {
  bindings: Record<string, CosmValue>,
  parent?: CosmEnv,
  allowTopLevelRebinds?: boolean,
  currentBlock?: CosmValue,
};

export type CosmNumber = CosmNumberValue;
export type CosmBool = CosmBoolValue;
export type CosmString = CosmStringValue;
export type CosmSymbol = CosmSymbolValue;
export type CosmArray = CosmArrayValue;
export type CosmHash = CosmHashValue;
export type CosmObject = CosmObjectValue;
export type CosmFunction = CosmFunctionValue;
export type CosmMethod = CosmMethodValue;
export type CosmClass = CosmClassValue;

export type CosmValue =
  | CosmNumberValue
  | CosmBoolValue
  | CosmStringValue
  | CosmSymbolValue
  | CosmArrayValue
  | CosmHashValue
  | CosmObjectValue
  | CosmClassValue
  | CosmFunctionValue
  | CosmMethodValue
  | CosmHttpRouterValue
  | CosmMirrorValue
  | CosmErrorValue
  | CosmSchemaValue
  | CosmPromptValue
  | CosmAiValue
  | CosmSessionValue;

export type SurfaceNodeKind =
  | 'program'
  | 'statement_list'
  | 'statement'
  | 'class_stmt'
  | 'class_meta_stmt'
  | 'def_stmt'
  | 'class_def_stmt'
  | 'class_super'
  | 'class_body'
  | 'let_stmt'
  | 'require_stmt'
  | 'if_expr'
  | 'block_expr'
  | 'lambda_expr'
  | 'number'
  | 'bool'
  | 'string'
  | 'symbol'
  | 'ident'
  | 'ivar'
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
  | 'semantic_eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'access'
  | 'call'
  | 'yield';

export type SurfaceNode = {
  kind: SurfaceNodeKind;
  value: string;
  children?: SurfaceNode[];
  left?: SurfaceNode;
  right?: SurfaceNode;
  params?: string[];
  target?: string;
};
