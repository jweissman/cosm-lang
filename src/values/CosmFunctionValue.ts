import { CosmValue, CoreNode, CosmEnv } from "../types";
import { CosmStringValue } from "./CosmStringValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmFunctionValue extends CosmValueBase {
  readonly type = 'function';

  constructor(
    public readonly name: string,
    public readonly nativeCall?: (args: CosmValue[], selfValue?: CosmValue) => CosmValue,
    public readonly params?: string[],
    public readonly body?: CoreNode,
    public readonly env?: CosmEnv
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
