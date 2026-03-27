import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Construct } from "../Construct";
import { CosmClass, CosmEnv, CosmObject, CosmValue } from "../types";
import { CosmModuleValue } from "../values/CosmModuleValue";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

type Repository = {
  globals: Record<string, CosmValue>;
  classes: Record<string, CosmClass>;
  modules: Record<string, CosmObject>;
};

type RootHooks = {
  createEnv: (parent?: CosmEnv, options?: { allowTopLevelRebinds?: boolean }) => CosmEnv;
  evalInEnv: (source: string, env: CosmEnv) => CosmValue;
};

export class InterpreterRoots {
  private static sourcePath(name: string): string {
    return name.startsWith("cosm/") ? resolve(REPO_ROOT, name) : resolve(process.cwd(), name);
  }

  static preloadStdlibModules(repository: Repository, hooks: RootHooks): void {
    for (const name of ["cosm/ai.cosm", "cosm/spec.cosm", "cosm/enumerable.cosm"]) {
      const loaded = this.loadModuleIntoRepository(name, repository, hooks);
      if (loaded) {
        repository.modules[name] = loaded;
        repository.modules[name.replace(/\.cosm$/u, "")] = loaded;
      }
    }
  }

  static loadModuleIntoRepository(name: string, repository: Repository, hooks: RootHooks): CosmObject | undefined {
    if (!name.endsWith(".cosm")) {
      if (!name.endsWith(".ecosm")) {
        return undefined;
      }
      const cachedTemplate = repository.modules[name];
      if (cachedTemplate instanceof CosmModuleValue) {
        return cachedTemplate;
      }
      const source = readFileSync(this.sourcePath(name), "utf8");
      const templateModule = Construct.module(name, {
        source: Construct.string(source),
        render: Construct.nativeFunc("render", (args) => {
          if (args.length > 2) {
            throw new Error(`Arity error: render expects 0, 1, or 2 arguments, got ${args.length}`);
          }
          const [context, body] = args;
          return this.renderTemplateSource(source, context, body, hooks);
        }),
      }, repository.classes.Module);
      repository.modules[name] = templateModule;
      return templateModule;
    }
    const cachedModule = repository.modules[name];
    if (cachedModule instanceof CosmModuleValue) {
      return cachedModule;
    }
    const source = readFileSync(this.sourcePath(name), "utf8");
    const moduleEnv = hooks.createEnv();
    hooks.evalInEnv(source, moduleEnv);
    const directExport = this.directModuleExport(name, moduleEnv.bindings);
    const loadedModule = directExport ?? Construct.module(name, { ...moduleEnv.bindings }, repository.classes.Module);
    repository.modules[name] = loadedModule;
    return loadedModule;
  }

  private static directModuleExport(name: string, bindings: Record<string, CosmValue>): CosmObject | undefined {
    const expectedName = this.moduleExportName(name);
    if (!expectedName) {
      return undefined;
    }
    const entries = Object.entries(bindings);
    if (entries.length !== 1) {
      return undefined;
    }
    const [[bindingName, value]] = entries;
    if (bindingName !== expectedName || !(value instanceof CosmModuleValue)) {
      return undefined;
    }
    return value;
  }

  private static moduleExportName(name: string): string | undefined {
    const fileName = basename(name).replace(/\.(?:cosm|ecosm)$/u, "");
    if (!/^[a-z0-9_]+$/u.test(fileName)) {
      return undefined;
    }
    return fileName
      .split("_")
      .filter((segment) => segment.length > 0)
      .map((segment) => segment[0].toUpperCase() + segment.slice(1))
      .join("");
  }

  static classesObject(env: CosmEnv, repository: Repository): CosmValue {
    const classes = { ...repository.classes };
    for (let scope: CosmEnv | undefined = env; scope; scope = scope.parent) {
      for (const [name, value] of Object.entries(scope.bindings)) {
        if (value.type === "class") {
          classes[name] = value;
        }
      }
    }
    return Construct.namespace(classes, repository.classes.Namespace);
  }

  static renderTemplateSource(source: string, context: CosmValue | undefined, body: CosmValue | undefined, hooks: RootHooks): CosmValue {
    const env = this.createTemplateEnv(context, body, hooks);
    let output = "";
    let cursor = 0;

    while (cursor < source.length) {
      const nextHashInterpolation = source.indexOf("#{", cursor);
      const nextErbInterpolation = source.indexOf("<%=", cursor);
      const interpolationStart = this.nextTemplateInterpolation(nextHashInterpolation, nextErbInterpolation);
      if (interpolationStart === -1) {
        output += source.slice(cursor);
        break;
      }
      output += source.slice(cursor, interpolationStart);
      if (source.startsWith("#{", interpolationStart)) {
        const interpolationEnd = this.findTemplateExpressionEnd(source, interpolationStart + 2);
        const expression = source.slice(interpolationStart + 2, interpolationEnd).trim();
        const value = expression.length === 0
          ? Construct.string("")
          : hooks.evalInEnv(expression, env);
        output += value.toCosmString("interpolate");
        cursor = interpolationEnd + 1;
        continue;
      }
      const interpolationEnd = this.findTemplateTagEnd(source, interpolationStart + 3);
      const expression = source.slice(interpolationStart + 3, interpolationEnd).trim();
      const value = expression.length === 0
        ? Construct.string("")
        : hooks.evalInEnv(expression, env);
      output += value.toCosmString("interpolate");
      cursor = interpolationEnd + 2;
    }

    return Construct.string(output);
  }

  private static createTemplateEnv(context: CosmValue | undefined, body: CosmValue | undefined, hooks: RootHooks): CosmEnv {
    const env = hooks.createEnv();
    if (body !== undefined) {
      env.currentBlock = Construct.nativeFunc("<template yield>", (args) => {
        if (args.length !== 0) {
          throw new Error(`Arity error: template yield expects 0 arguments, got ${args.length}`);
        }
        return body;
      });
    }
    if (!context) {
      return env;
    }
    env.bindings.context = context;
    switch (context.type) {
      case "hash":
        Object.assign(env.bindings, context.entries);
        break;
      case "object":
        Object.assign(env.bindings, context.fields);
        break;
    }
    return env;
  }

  private static nextTemplateInterpolation(hashIndex: number, erbIndex: number): number {
    if (hashIndex === -1) {
      return erbIndex;
    }
    if (erbIndex === -1) {
      return hashIndex;
    }
    return Math.min(hashIndex, erbIndex);
  }

  private static findTemplateExpressionEnd(source: string, startIndex: number): number {
    let index = startIndex;
    let depth = 1;
    let inSingle = false;
    let inDouble = false;
    let inTripleDouble = false;
    let escaped = false;

    while (index < source.length) {
      const nextThree = source.slice(index, index + 3);
      const char = source[index];

      if (inTripleDouble) {
        if (nextThree === `"""`) {
          inTripleDouble = false;
          index += 3;
          continue;
        }
        index += 1;
        continue;
      }

      if (inSingle || inDouble) {
        if (escaped) {
          escaped = false;
          index += 1;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          index += 1;
          continue;
        }
        if (inSingle && char === "'") {
          inSingle = false;
        } else if (inDouble && char === `"`) {
          inDouble = false;
        }
        index += 1;
        continue;
      }

      if (nextThree === `"""`) {
        inTripleDouble = true;
        index += 3;
        continue;
      }
      if (char === "'") {
        inSingle = true;
        index += 1;
        continue;
      }
      if (char === `"`) {
        inDouble = true;
        index += 1;
        continue;
      }
      if (source.slice(index, index + 2) === "#{") {
        depth += 1;
        index += 2;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }
      index += 1;
    }

    throw new Error("Template parse error: missing closing } for interpolation");
  }

  private static findTemplateTagEnd(source: string, startIndex: number): number {
    let index = startIndex;
    let inSingle = false;
    let inDouble = false;
    let inTripleDouble = false;
    let escaped = false;

    while (index < source.length) {
      const nextThree = source.slice(index, index + 3);
      const nextTwo = source.slice(index, index + 2);
      const char = source[index];

      if (inTripleDouble) {
        if (nextThree === `"""`) {
          inTripleDouble = false;
          index += 3;
          continue;
        }
        index += 1;
        continue;
      }

      if (inSingle || inDouble) {
        if (escaped) {
          escaped = false;
          index += 1;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          index += 1;
          continue;
        }
        if (inSingle && char === "'") {
          inSingle = false;
        } else if (inDouble && char === `"`) {
          inDouble = false;
        }
        index += 1;
        continue;
      }

      if (nextThree === `"""`) {
        inTripleDouble = true;
        index += 3;
        continue;
      }
      if (char === "'") {
        inSingle = true;
        index += 1;
        continue;
      }
      if (char === `"`) {
        inDouble = true;
        index += 1;
        continue;
      }
      if (nextTwo === "%>") {
        return index;
      }
      index += 1;
    }

    throw new Error("Template parse error: missing closing %> for interpolation");
  }
}
