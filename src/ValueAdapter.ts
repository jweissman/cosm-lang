import { CosmValue } from "./types";
import { CosmHttpRequestValue } from "./values/CosmHttpRequestValue";
import { CosmHttpResponseValue } from "./values/CosmHttpResponseValue";
import { CosmHttpServerValue } from "./values/CosmHttpServerValue";
import { CosmHttpRouterValue } from "./values/CosmHttpRouterValue";
import { CosmMirrorValue } from "./values/CosmMirrorValue";
import { CosmModuleValue } from "./values/CosmModuleValue";
import { CosmNamespaceValue } from "./values/CosmNamespaceValue";

type JsValue =
  | number
  | boolean
  | string
  | null
  | { [key: string]: JsValue }
  | JsValue[];

export class ValueAdapter {
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
    switch (value.type) {
      case 'number':
        return String(value.value);
      case 'bool':
        return String(value.value);
      case 'string':
        return JSON.stringify(value.value);
      case 'symbol':
        return `:${value.name}`;
      case 'array':
        return `[${value.items.map((item) => this.format(item)).join(', ')}]`;
      case 'hash':
        return `{ ${Object.entries(value.entries).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(', ')} }`;
      case 'function':
        return `<function ${value.name}>`;
      case 'method':
        return `<method ${value.name}>`;
      case 'class':
        return value.name;
      case 'object': {
        if (value instanceof CosmNamespaceValue) {
          const namespaceEntries = Object.entries(value.fields).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(', ');
          return namespaceEntries.length > 0 ? `#<Namespace ${namespaceEntries}>` : "#<Namespace>";
        }
        if (value instanceof CosmModuleValue) {
          const moduleEntries = Object.entries(value.fields).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(', ');
          return moduleEntries.length > 0
            ? `#<Module ${JSON.stringify(value.moduleName)} ${moduleEntries}>`
            : `#<Module ${JSON.stringify(value.moduleName)}>`;
        }
        if (value instanceof CosmHttpServerValue) {
          return `#<HttpServer url: ${JSON.stringify(value.url)}, port: ${value.port}>`;
        }
        if (value instanceof CosmHttpRouterValue) {
          return `#<HttpRouter routes: ${value.nativeProperty("length") ? this.format(value.nativeProperty("length")!) : "0"}>`;
        }
        if (value instanceof CosmHttpRequestValue) {
          return `#<HttpRequest ${value.method} ${value.path}>`;
        }
        if (value instanceof CosmHttpResponseValue) {
          return `#<HttpResponse ${value.status} ${this.format(value.body)}>`;
        }
        if (value instanceof CosmMirrorValue) {
          return `#<Mirror ${this.format(value.target)}>`;
        }
        const entries = Object.entries(value.fields).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(', ');
        if (value.className === 'Object') {
          return `{ ${entries} }`;
        }
        return entries.length > 0 ? `#<${value.className} ${entries}>` : `#<${value.className}>`;
      }
    }
  }
}
