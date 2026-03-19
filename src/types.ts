export type CoreNodeKind =
  | 'program'
  | 'block'
  | 'class'
  | 'let'
  | 'def'
  | 'class_def'
  | 'if'
  | 'lambda'
  | 'number'
  | 'bool'
  | 'string'
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
  target?: string;
};

export type CosmEnv = { bindings: Record<string, CosmValue>, parent?: CosmEnv };

export abstract class CosmValueBase {
  abstract readonly type: string;

  plus(_right: CosmValue): CosmValue {
    throw new Error('Type error: add expects numeric operands or string concatenation');
  }

  nativeProperty(_name: string): CosmValue | undefined {
    return undefined;
  }

  nativeMethod(_name: string): CosmFunctionValue | undefined {
    return undefined;
  }

  toCosmString(context: 'concatenate' | 'interpolate'): string {
    if (context === 'interpolate') {
      throw new Error(`Type error: cannot interpolate value of type ${this.type} into a string`);
    }
    throw new Error(`Type error: cannot concatenate value of type ${this.type} into a string`);
  }
}

export class CosmNumberValue extends CosmValueBase {
  readonly type = 'number';

  constructor(public readonly value: number) {
    super();
  }

  override plus(right: CosmValue): CosmValue {
    if (right instanceof CosmNumberValue) {
      return new CosmNumberValue(this.value + right.value);
    }
    throw new Error('Type error: add expects numeric operands or string concatenation');
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    if (name !== 'plus') {
      return undefined;
    }
    return new CosmFunctionValue('plus', (args, selfValue) => {
      if (!(selfValue instanceof CosmNumberValue)) {
        throw new Error('Type error: plus expects a numeric receiver');
      }
      if (args.length !== 1) {
        throw new Error(`Arity error: method plus expects 1 arguments, got ${args.length}`);
      }
      return selfValue.plus(args[0]);
    });
  }

  override toCosmString(): string {
    return String(this.value);
  }
}

export class CosmBoolValue extends CosmValueBase {
  readonly type = 'bool';

  constructor(public readonly value: boolean) {
    super();
  }

  override toCosmString(): string {
    return String(this.value);
  }
}

export class CosmStringValue extends CosmValueBase {
  readonly type = 'string';

  constructor(public readonly value: string) {
    super();
  }

  override plus(right: CosmValue): CosmValue {
    return new CosmStringValue(this.value + right.toCosmString('concatenate'));
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    if (name !== 'plus') {
      return undefined;
    }
    return new CosmFunctionValue('plus', (args, selfValue) => {
      if (!(selfValue instanceof CosmStringValue)) {
        throw new Error('Type error: plus expects a string receiver');
      }
      if (args.length !== 1) {
        throw new Error(`Arity error: method plus expects 1 arguments, got ${args.length}`);
      }
      return selfValue.plus(args[0]);
    });
  }

  override nativeProperty(name: string): CosmValue | undefined {
    if (name === 'length') {
      return new CosmNumberValue(this.value.length);
    }
    return undefined;
  }

  override toCosmString(): string {
    return this.value;
  }
}

export class CosmArrayValue extends CosmValueBase {
  readonly type = 'array';

  constructor(public readonly items: CosmValue[]) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    if (name === 'length') {
      return new CosmNumberValue(this.items.length);
    }
    return undefined;
  }
}

export class CosmHashValue extends CosmValueBase {
  readonly type = 'hash';

  constructor(public readonly entries: Record<string, CosmValue>) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    if (name === 'length') {
      return new CosmNumberValue(Object.keys(this.entries).length);
    }
    return undefined;
  }
}

export class CosmFunctionValue extends CosmValueBase {
  readonly type = 'function';

  constructor(
    public readonly name: string,
    public readonly nativeCall?: (args: CosmValue[], selfValue?: CosmValue) => CosmValue,
    public readonly params?: string[],
    public readonly body?: CoreNode,
    public readonly env?: CosmEnv,
  ) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    if (name === 'name') {
      return new CosmStringValue(this.name);
    }
    return undefined;
  }
}

export class CosmClassValue extends CosmValueBase {
  readonly type = 'class';

  constructor(
    public readonly name: string,
    public readonly superclassName?: string,
    public readonly slots: string[] = [],
    public readonly methods: Record<string, CosmFunctionValue> = {},
    public readonly classMethods: Record<string, CosmFunctionValue> = {},
    public readonly superclass?: CosmClassValue,
    public classRef?: CosmClassValue,
  ) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    if (name === 'name') {
      return new CosmStringValue(this.name);
    }
    if (name === 'metaclass') {
      return this.classRef;
    }
    if (name === 'superclass') {
      return this.superclass;
    }
    if (name === 'slots') {
      return new CosmArrayValue(this.slots.map((slot) => new CosmStringValue(slot)));
    }
    if (name === 'methods') {
      return new CosmObjectValue('Object', this.methods);
    }
    if (name === 'classMethods') {
      const classMethodOwner = this.classRef && this.classRef !== this ? this.classRef : undefined;
      return new CosmObjectValue('Object', classMethodOwner?.methods ?? this.classMethods);
    }
    return undefined;
  }
}

export class CosmObjectValue extends CosmValueBase {
  readonly type = 'object';

  constructor(
    public readonly className: string,
    public readonly fields: Record<string, CosmValue>,
    public readonly classRef?: CosmClassValue,
  ) {
    super();
  }
}

export type CosmNumber = CosmNumberValue;
export type CosmBool = CosmBoolValue;
export type CosmString = CosmStringValue;
export type CosmArray = CosmArrayValue;
export type CosmHash = CosmHashValue;
export type CosmObject = CosmObjectValue;
export type CosmFunction = CosmFunctionValue;
export type CosmClass = CosmClassValue;

export type CosmValue =
  | CosmNumberValue
  | CosmBoolValue
  | CosmStringValue
  | CosmArrayValue
  | CosmHashValue
  | CosmObjectValue
  | CosmClassValue
  | CosmFunctionValue;

export type SurfaceNodeKind =
  | 'program'
  | 'statement_list'
  | 'statement'
  | 'class_stmt'
  | 'def_stmt'
  | 'class_def_stmt'
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
  target?: string;
};
