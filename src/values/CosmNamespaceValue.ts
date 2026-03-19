import { CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmObjectValue } from "./CosmObjectValue";


export class CosmNamespaceValue extends CosmObjectValue {
  constructor(fields: Record<string, CosmValue>, classRef?: CosmClassValue) {
    super('Namespace', fields, classRef);
  }
}
