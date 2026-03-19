import { CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmObjectValue } from "./CosmObjectValue";


export class CosmKernelValue extends CosmObjectValue {
  constructor(fields: Record<string, CosmValue>, classRef?: CosmClassValue) {
    super('Kernel', fields, classRef);
  }
}
