import { CosmValue } from "../types";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmArrayValue extends CosmValueBase {
  readonly type = 'array';

  constructor(public readonly items: CosmValue[]) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    if (name === 'length') {
      return new CosmNumberValue(this.items.length);
    }
    return undefined;
  }
}
