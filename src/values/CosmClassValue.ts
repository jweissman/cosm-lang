import { CosmValue } from "../types";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmClassValue extends CosmValueBase {
  readonly type = 'class';

  constructor(
    public readonly name: string,
    public readonly superclassName?: string,
    public readonly slots: string[] = [],
    public readonly methods: Record<string, CosmFunctionValue> = {},
    public readonly classMethods: Record<string, CosmFunctionValue> = {},
    public readonly superclass?: CosmClassValue,
    public classRef?: CosmClassValue
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
