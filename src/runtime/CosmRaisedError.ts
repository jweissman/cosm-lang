import { CosmErrorValue } from "../values/CosmErrorValue";

export class CosmRaisedError extends Error {
  constructor(public readonly cosmError: CosmErrorValue) {
    super(cosmError.messageText);
    this.name = "CosmRaisedError";
  }
}
