import {
  CosmNumber,
  CosmBool,
  CosmString,
  CosmSymbol,
  CosmValue,
  CosmArray,
  CosmHash,
  CosmObject,
  CosmFunction,
  CosmMethod,
  CosmClass,
  CoreNode,
  CosmEnv,
} from "./types";
import { CosmNamespaceValue } from "./values/CosmNamespaceValue";
import { CosmKernelValue } from "./values/CosmKernelValue";
import { CosmObjectValue } from "./values/CosmObjectValue";
import { CosmClassValue } from "./values/CosmClassValue";
import { CosmFunctionValue } from "./values/CosmFunctionValue";
import { CosmHashValue } from "./values/CosmHashValue";
import { CosmArrayValue } from "./values/CosmArrayValue";
import { CosmStringValue } from "./values/CosmStringValue";
import { CosmBoolValue } from "./values/CosmBoolValue";
import { CosmNumberValue } from "./values/CosmNumberValue";
import { CosmSymbolValue } from "./values/CosmSymbolValue";
import { CosmMethodValue } from "./values/CosmMethodValue";
import { CosmModuleValue } from "./values/CosmModuleValue";
import { CosmErrorValue } from "./values/CosmErrorValue";
import { CosmSchemaValue } from "./values/CosmSchemaValue";
import { CosmPromptValue } from "./values/CosmPromptValue";
import { CosmAiValue } from "./values/CosmAiValue";
import { CosmSessionValue } from "./values/CosmSessionValue";
import { CosmDataModelValue } from "./values/CosmDataModelValue";

export class Construct {
  static number(value: number): CosmNumber { return new CosmNumberValue(value); }
  static bool(value: boolean): CosmBool { return new CosmBoolValue(value); }
  static string(value: string): CosmString { return new CosmStringValue(value); }
  static symbol(name: string): CosmSymbol { return new CosmSymbolValue(name); }
  static array(items: CosmValue[]): CosmArray { return new CosmArrayValue(items); }
  static hash(entries: Record<string, CosmValue>): CosmHash { return new CosmHashValue(entries); }
  static object(className: string, fields: Record<string, CosmValue>, classRef?: CosmClass): CosmObject {
    return new CosmObjectValue(className, fields, classRef);
  }
  static kernel(fields: Record<string, CosmValue>, classRef?: CosmClass): CosmObject {
    return new CosmKernelValue(fields, classRef);
  }
  static namespace(fields: Record<string, CosmValue>, classRef?: CosmClass): CosmObject {
    return new CosmNamespaceValue(fields, classRef);
  }
  static module(name: string, fields: Record<string, CosmValue>, classRef?: CosmClass): CosmObject {
    return new CosmModuleValue(name, fields, classRef);
  }
  static error(message: string, backtrace: string[] = [], details: CosmValue = this.bool(false), classRef?: CosmClass): CosmObject {
    return new CosmErrorValue(message, backtrace, details, classRef);
  }
  static schema(kind: "string" | "number" | "boolean" | "array" | "enum" | "object" | "optional", state: Record<string, CosmValue> = {}, classRef?: CosmClass, errorClassRef?: CosmClass): CosmObject {
    return new CosmSchemaValue(kind, state, classRef, errorClassRef);
  }
  static prompt(source: string, classRef?: CosmClass): CosmObject {
    return new CosmPromptValue(source, classRef);
  }
  static ai(fields: Record<string, CosmValue>, classRef?: CosmClass, errorClassRef?: CosmClass): CosmObject {
    return new CosmAiValue(fields, classRef, errorClassRef);
  }
  static session(name: string, classRef?: CosmClass, errorClassRef?: CosmClass): CosmObject {
    return new CosmSessionValue(name, classRef, errorClassRef);
  }
  static dataModel(name: string, fieldSchemas: Record<string, CosmSchemaValue>, classRef?: CosmClass, schemaClassRef?: CosmClass, errorClassRef?: CosmClass, namespaceClassRef?: CosmClass): CosmObject {
    return new CosmDataModelValue(name, fieldSchemas, classRef, schemaClassRef, errorClassRef, namespaceClassRef);
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
  static nativeFunc(name: string, nativeCall: (args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue): CosmFunction {
    return new CosmFunctionValue(name, nativeCall);
  }
  static method(name: string, receiver: CosmValue, target: CosmFunction): CosmMethod {
    return new CosmMethodValue(name, receiver, target);
  }
  static closure(name: string, params: string[], body: CoreNode, env: CosmEnv, defaults?: Record<string, CoreNode>, restParam?: string): CosmFunction {
    return new CosmFunctionValue(name, undefined, params, restParam, defaults, body, env);
  }
}
