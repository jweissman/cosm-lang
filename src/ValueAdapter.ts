import { CosmValue } from "./types";
import { CosmHttpRequestValue } from "./values/CosmHttpRequestValue";
import { CosmHttpResponseValue } from "./values/CosmHttpResponseValue";
import { CosmHttpServerValue } from "./values/CosmHttpServerValue";
import { CosmHttpRouterValue } from "./values/CosmHttpRouterValue";
import { CosmMirrorValue } from "./values/CosmMirrorValue";
import { CosmModuleValue } from "./values/CosmModuleValue";
import { CosmNamespaceValue } from "./values/CosmNamespaceValue";
import { CosmErrorValue } from "./values/CosmErrorValue";
import { CosmSchemaValue } from "./values/CosmSchemaValue";
import { CosmPromptValue } from "./values/CosmPromptValue";
import { CosmAiValue } from "./values/CosmAiValue";
import { CosmSessionValue } from "./values/CosmSessionValue";
import { RuntimeInspect } from "./runtime/RuntimeInspect";
import { Construct } from "./Construct";

type JsValue =
  | number
  | boolean
  | string
  | null
  | { [key: string]: JsValue }
  | JsValue[];

export class ValueAdapter {
  static jsToCosm(value: JsValue): CosmValue {
    if (value === null) {
      return Construct.bool(false);
    }
    if (typeof value === "number") {
      return Construct.number(value);
    }
    if (typeof value === "boolean") {
      return Construct.bool(value);
    }
    if (typeof value === "string") {
      return Construct.string(value);
    }
    if (Array.isArray(value)) {
      return Construct.array(value.map((item) => this.jsToCosm(item)));
    }
    return Construct.hash(
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, this.jsToCosm(entry)]),
      ),
    );
  }

  static cosmToJS(value: CosmValue): JsValue {
    switch (value.type) {
      case 'number':
        return value.value;
      case 'bool':
        return value.value;
      case 'string':
        return value.value;
      case 'symbol':
        return { kind: 'symbol', name: value.name };
      case 'array':
        return value.items.map((item) => this.cosmToJS(item));
      case 'hash':
        return Object.fromEntries(
          Object.entries(value.entries).map(([key, entry]) => [key, this.cosmToJS(entry)]),
        );
      case 'class':
        return {
          kind: 'class',
          name: value.name,
          superclassName: value.superclassName,
          metaclassName: value.classRef?.name,
          slots: value.slots,
          methods: Object.keys(value.methods),
          classMethods: Object.keys((value.classRef && value.classRef !== value ? value.classRef.methods : value.classMethods)),
          className: value.classRef?.name ?? 'Class',
        };
      case 'object':
        if (value instanceof CosmNamespaceValue) {
          return Object.fromEntries(
            Object.entries(value.fields).map(([key, entry]) => [key, this.cosmToJS(entry)]),
          );
        }
        if (value instanceof CosmModuleValue) {
          return {
            kind: "module",
            name: value.moduleName,
            entries: Object.fromEntries(
              Object.entries(value.fields).map(([key, entry]) => [key, this.cosmToJS(entry)]),
            ),
          };
        }
        if (value instanceof CosmHttpServerValue) {
          return {
            kind: 'http_server',
            port: value.port,
            url: value.url,
          };
        }
        if (value instanceof CosmHttpRouterValue) {
          return {
            kind: "http_router",
            length: value.nativeProperty("length") && this.cosmToJS(value.nativeProperty("length")!),
          };
        }
        if (value instanceof CosmHttpRequestValue) {
          return {
            kind: 'http_request',
            method: value.method,
            url: value.url,
            path: value.path,
            headers: this.cosmToJS(value.headers),
            query: this.cosmToJS(value.query),
          };
        }
        if (value instanceof CosmHttpResponseValue) {
          return {
            kind: 'http_response',
            status: value.status,
            body: this.cosmToJS(value.body),
            headers: this.cosmToJS(value.headers),
          };
        }
        if (value instanceof CosmMirrorValue) {
          return {
            kind: "mirror",
            targetClass: value.nativeProperty("targetClass") ? this.cosmToJS(value.nativeProperty("targetClass")!) : null,
          };
        }
        if (value instanceof CosmErrorValue) {
          return {
            kind: "error",
            message: value.messageText,
            backtrace: value.backtraceItems,
            details: value.detailsValue.type === "bool" && value.detailsValue.value === false ? false : this.cosmToJS(value.detailsValue),
          };
        }
        if (value instanceof CosmSchemaValue) {
          return {
            kind: "schema",
            description: value.nativeMethod("describe")?.nativeCall?.([], value) ? this.cosmToJS(value.nativeMethod("describe")!.nativeCall!([], value)) : null,
          };
        }
        if (value instanceof CosmPromptValue) {
          return {
            kind: "prompt",
            source: value.sourceText,
          };
        }
        if (value instanceof CosmAiValue) {
          return {
            kind: "ai",
          };
        }
        if (value instanceof CosmSessionValue) {
          return {
            kind: "session",
            name: value.nativeProperty("name") ? this.cosmToJS(value.nativeProperty("name")!) : null,
            length: value.nativeProperty("length") ? this.cosmToJS(value.nativeProperty("length")!) : 0,
          };
        }
        return Object.fromEntries(
          Object.entries(value.fields).map(([key, entry]) => [key, this.cosmToJS(entry)]),
        );
      case 'function':
        return { kind: 'function', name: value.name };
      case 'method':
        return {
          kind: 'method',
          name: value.name,
          receiverType: value.receiver.type,
          receiverClassName: value.receiver.type === 'object' ? value.receiver.className : undefined,
        };
    }
  }

  static format(value: CosmValue): string {
    return RuntimeInspect.format(value);
  }
}
