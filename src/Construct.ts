import {
  CosmNumber,
  CosmBool,
  CosmString,
  CosmValue,
  CosmArray,
  CosmHash,
  CosmObject,
  CosmFunction,
  CosmClass,
  CoreNode,
  CosmEnv,
  CosmNumberValue,
  CosmBoolValue,
  CosmStringValue,
  CosmArrayValue,
  CosmHashValue,
  CosmObjectValue,
  CosmClassValue,
  CosmFunctionValue,
} from "./types";

export class Construct {
  static number(value: number): CosmNumber { return new CosmNumberValue(value); }
  static bool(value: boolean): CosmBool { return new CosmBoolValue(value); }
  static string(value: string): CosmString { return new CosmStringValue(value); }
  static array(items: CosmValue[]): CosmArray { return new CosmArrayValue(items); }
  static hash(entries: Record<string, CosmValue>): CosmHash { return new CosmHashValue(entries); }
  static object(className: string, fields: Record<string, CosmValue>, classRef?: CosmClass): CosmObject {
    return new CosmObjectValue(className, fields, classRef);
  }
  static class(
    name: string,
    superclassName?: string,
    slots: string[] = [],
    methods: Record<string, CosmFunction> = {},
    classMethods: Record<string, CosmFunction> = {},
    superclass?: CosmClass,
    classRef?: CosmClass
  ): CosmClass {
    return new CosmClassValue(name, superclassName, slots, methods, classMethods, superclass, classRef);
  }
  static nativeFunc(name: string, nativeCall: (args: CosmValue[], selfValue?: CosmValue) => CosmValue): CosmFunction {
    return new CosmFunctionValue(name, nativeCall);
  }
  static closure(name: string, params: string[], body: CoreNode, env: CosmEnv): CosmFunction {
    return new CosmFunctionValue(name, undefined, params, body, env);
  }
}
