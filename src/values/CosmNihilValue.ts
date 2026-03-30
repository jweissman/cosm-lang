import { CosmValueBase } from "./CosmValueBase";

export class CosmNihilValue extends CosmValueBase {
  readonly type = "nihil";

  override toCosmString(_context: "concatenate" | "interpolate"): string {
    return "nihil";
  }
}
