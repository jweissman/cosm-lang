import { Construct } from "../Construct";
import { CosmArray, CosmClass, CosmHash, CosmObject, CosmValue } from "../types";

export class RuntimeEquality {
  static compare(left: CosmValue, right: CosmValue): boolean {
    if (left.type !== right.type) {
      return false;
    }
    switch (left.type) {
      case 'number':
      case 'bool':
      case 'string':
        return left.value === (right as typeof left).value;
      case 'symbol':
        return left.name === (right as typeof left).name;
      case 'class':
        return left.name === (right as CosmClass).name;
      case 'function':
      case 'method':
        return left === right;
      case 'array': {
        const rightArray = right as CosmArray;
        return left.items.length === rightArray.items.length
          && left.items.every((item, index) => this.compare(item, rightArray.items[index]));
      }
      case 'hash': {
        const rightHash = right as CosmHash;
        const leftKeys = Object.keys(left.entries);
        const rightKeys = Object.keys(rightHash.entries);
        return leftKeys.length === rightKeys.length
          && leftKeys.every((key) => key in rightHash.entries && this.compare(left.entries[key], rightHash.entries[key]));
      }
      case 'object': {
        const rightObject = right as CosmObject;
        return left.className === rightObject.className
          && this.compare(Construct.hash(left.fields), Construct.hash(rightObject.fields));
      }
    }
  }
}
