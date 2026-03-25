import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Construct } from "../Construct";
import { CosmClass, CosmEnv, CosmObject, CosmValue } from "../types";
import { CosmModuleValue } from "../values/CosmModuleValue";

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
      const source = readFileSync(resolve(process.cwd(), name), "utf8");
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
    const source = readFileSync(resolve(process.cwd(), name), "utf8");
    const moduleEnv = hooks.createEnv();
    hooks.evalInEnv(source, moduleEnv);
    const loadedModule = Construct.module(name, { ...moduleEnv.bindings }, repository.classes.Module);
    repository.modules[name] = loadedModule;
    return loadedModule;
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

  static cosmObject(env: CosmEnv, repository: Repository, version: string): CosmValue {
    const moduleEntries = Object.fromEntries(
      Object.entries(repository.modules)
        .filter(([name]) => name.startsWith("cosm/") && !name.endsWith(".ecosm"))
        .map(([name, value]) => {
          const key = name
            .replace(/^cosm\//u, "")
            .replace(/\.(cosm)$/u, "")
            .split("/")
            .at(-1) as string;
          return [key, value];
        }),
    );
    return Construct.namespace({
      Kernel: repository.globals.Kernel,
      Process: repository.globals.Process,
      Time: repository.globals.Time,
      Random: repository.globals.Random,
      Mirror: repository.globals.Mirror,
      Error: repository.globals.Error,
      Schema: repository.globals.Schema,
      Prompt: repository.globals.Prompt,
      Session: repository.globals.Session,
      Data: repository.globals.Data,
      HttpRouter: repository.globals.HttpRouter,
      ai: repository.globals.ai,
      http: repository.globals.http,
      modules: Construct.namespace(moduleEntries, repository.classes.Namespace),
      classes: this.classesObject(env, repository),
      test: repository.modules["cosm/test"],
      version: Construct.string(version),
    }, repository.classes.Namespace);
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
