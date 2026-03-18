import { CosmNumber, CosmBool, CosmString, CosmValue, CosmArray, CosmHash, CosmObject, CosmFunction, CosmClass, CoreNode, CosmEnv } from "./types";

export class Construct {
  static number(value: number): CosmNumber { return { type: 'number', value }; }
  static bool(value: boolean): CosmBool { return { type: 'bool', value }; }
  static string(value: string): CosmString { return { type: 'string', value }; }
  static array(items: CosmValue[]): CosmArray { return { type: 'array', items }; }
  static hash(entries: Record<string, CosmValue>): CosmHash { return { type: 'hash', entries }; }
  static object(className: string, fields: Record<string, CosmValue>, classRef?: CosmClass): CosmObject {
    return { type: 'object', className, classRef, fields };
  }
  static class(
    name: string,
    superclassName?: string,
    methods: Record<string, CosmFunction> = {},
    superclass?: CosmClass
  ): CosmClass {
    return { type: 'class', name, superclassName, methods, superclass };
  }
  static nativeFunc(name: string, nativeCall: (args: CosmValue[]) => CosmValue): CosmFunction {
    return { type: 'function', name, nativeCall };
  }
  static closure(name: string, params: string[], body: CoreNode, env: CosmEnv): CosmFunction {
    return { type: 'function', name, params, body, env };
  }
}
