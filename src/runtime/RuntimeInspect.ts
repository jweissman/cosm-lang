import { CosmValue } from "../types";

export class RuntimeInspect {
  static format(value: CosmValue): string {
    switch (value.type) {
      case "number":
        return String(value.value);
      case "bool":
        return String(value.value);
      case "string":
        return JSON.stringify(value.value);
      case "symbol":
        return `:${value.name}`;
      case "array":
        return `[${value.items.map((item) => this.format(item)).join(", ")}]`;
      case "hash":
        return `{ ${Object.entries(value.entries).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(", ")} }`;
      case "function":
        return `<function ${value.name}>`;
      case "method":
        return `<method ${value.name}>`;
      case "class":
        return value.name;
      case "object": {
        if (value.className === "Namespace") {
          const entries = Object.entries(value.fields).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(", ");
          return entries.length > 0 ? `#<Namespace ${entries}>` : "#<Namespace>";
        }
        if ("moduleName" in value && typeof value.moduleName === "string") {
          const entries = Object.entries(value.fields).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(", ");
          return entries.length > 0
            ? `#<Module ${JSON.stringify(value.moduleName)} ${entries}>`
            : `#<Module ${JSON.stringify(value.moduleName)}>`;
        }
        if (value.className === "HttpServer" && "url" in value && "port" in value) {
          return `#<HttpServer url: ${JSON.stringify(value.url)}, port: ${String(value.port)}>`;
        }
        if (value.className === "HttpRouter") {
          const length = value.nativeProperty("length");
          return `#<HttpRouter routes: ${length ? this.format(length) : "0"}>`;
        }
        if (value.className === "HttpRequest" && "method" in value && "path" in value) {
          return `#<HttpRequest ${String(value.method)} ${String(value.path)}>`;
        }
        if (value.className === "HttpResponse" && "status" in value && "body" in value) {
          return `#<HttpResponse ${value.status} ${this.format(value.body)}>`;
        }
        if (value.className === "Mirror" && "target" in value) {
          return `#<Mirror ${this.format(value.target)}>`;
        }
        if (value.className === "Error" && "messageText" in value) {
          return `#<Error ${JSON.stringify(String(value.messageText))}>`;
        }
        if (value.className === "Schema") {
          const described = value.nativeMethod("describe")?.nativeCall?.([], value);
          return described?.type === "string" ? described.value : "#<Schema>";
        }
        if (value.className === "Prompt" && "sourceText" in value) {
          return `#<Prompt ${JSON.stringify(String(value.sourceText))}>`;
        }
        if (value.className === "Ai") {
          return "#<Ai>";
        }
        if (value.className === "Session" && "sessionName" in value) {
          const length = value.nativeProperty("length");
          return `#<Session ${JSON.stringify(String(value.sessionName))} history: ${length ? this.format(length) : "0"}>`;
        }
        if (value.className === "DataModel" && "modelName" in value) {
          return `#<Data::Model ${JSON.stringify(String(value.modelName))}>`;
        }
        const entries = Object.entries(value.fields).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(", ");
        if (value.className === "Object") {
          return `{ ${entries} }`;
        }
        return entries.length > 0 ? `#<${value.className} ${entries}>` : `#<${value.className}>`;
      }
    }
  }
}
