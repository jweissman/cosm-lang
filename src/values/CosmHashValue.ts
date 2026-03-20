import { CosmValue } from "../types";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmValueBase } from "./CosmValueBase";


export class CosmHashValue extends CosmValueBase {
  readonly type = 'hash';

  constructor(public readonly entries: Record<string, CosmValue>) {
    super();
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    if (name === 'length') {
      return new CosmNumberValue(Object.keys(this.entries).length);
    }
    return this.entries[name];
  }
}
