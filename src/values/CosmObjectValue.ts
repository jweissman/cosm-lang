import { CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmObjectValue extends CosmValueBase {
  readonly type = 'object';

  constructor(
    public readonly className: string,
    public readonly fields: Record<string, CosmValue>,
    public readonly classRef?: CosmClassValue
  ) {
    super();
  }
}
