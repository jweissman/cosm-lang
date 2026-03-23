import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestClassMethods, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmHashValue } from "./CosmHashValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmBoolValue } from "./CosmBoolValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { Construct } from "../Construct";
import { CosmErrorValue } from "./CosmErrorValue";
import { ValueAdapter } from "../ValueAdapter";

type SchemaKind = "string" | "number" | "boolean" | "array" | "enum" | "object" | "optional";

export class CosmSchemaValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmSchemaValue> = {
    properties: {
      kind: (self) => new CosmStringValue(self.schemaKind),
    },
    methods: {
      validate: () => new CosmFunctionValue("validate", (args, selfValue) => {
        if (!(selfValue instanceof CosmSchemaValue)) {
          throw new Error("Type error: validate expects a Schema receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: Schema.validate expects 1 arguments, got ${args.length}`);
        }
        selfValue.validateValue(args[0], "$");
        return new CosmBoolValue(true);
      }),
      cast: () => new CosmFunctionValue("cast", (args, selfValue) => {
        if (!(selfValue instanceof CosmSchemaValue)) {
          throw new Error("Type error: cast expects a Schema receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: Schema.cast expects 1 arguments, got ${args.length}`);
        }
        return selfValue.castValue(args[0], "$");
      }),
      describe: () => new CosmFunctionValue("describe", (args, selfValue) => {
        if (!(selfValue instanceof CosmSchemaValue)) {
          throw new Error("Type error: describe expects a Schema receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Schema.describe expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(selfValue.describeSchema());
      }),
      inspect: () => new CosmFunctionValue("inspect", (args, selfValue) => {
        if (!(selfValue instanceof CosmSchemaValue)) {
          throw new Error("Type error: inspect expects a Schema receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Schema.inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(selfValue.describeSchema());
      }),
    },
    classMethods: {
      string: () => new CosmFunctionValue("string", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Schema.string expects a class receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Schema.string expects 0 arguments, got ${args.length}`);
        }
        return new CosmSchemaValue("string", {}, selfValue, selfValue.classRef);
      }),
      number: () => new CosmFunctionValue("number", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Schema.number expects a class receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Schema.number expects 0 arguments, got ${args.length}`);
        }
        return new CosmSchemaValue("number", {}, selfValue, selfValue.classRef);
      }),
      boolean: () => new CosmFunctionValue("boolean", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Schema.boolean expects a class receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Schema.boolean expects 0 arguments, got ${args.length}`);
        }
        return new CosmSchemaValue("boolean", {}, selfValue, selfValue.classRef);
      }),
      array: () => new CosmFunctionValue("array", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Schema.array expects a class receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: Schema.array expects 1 arguments, got ${args.length}`);
        }
        const [inner] = args;
        const itemSchema = this.expectSchema(inner, "Schema.array");
        return new CosmSchemaValue("array", { item: itemSchema }, selfValue, selfValue.classRef);
      }),
      enum: () => new CosmFunctionValue("enum", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Schema.enum expects a class receiver");
        }
        if (args.length < 1) {
          throw new Error("Arity error: Schema.enum expects at least 1 argument");
        }
        return new CosmSchemaValue("enum", { options: new CosmArrayValue(args) }, selfValue, selfValue.classRef);
      }),
      object: () => new CosmFunctionValue("object", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Schema.object expects a class receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: Schema.object expects 1 arguments, got ${args.length}`);
        }
        const [fields] = args;
        const fieldMap = this.expectSchemaFields(fields);
        return new CosmSchemaValue("object", { fields: new CosmNamespaceValue(fieldMap) }, selfValue, selfValue.classRef);
      }),
      optional: () => new CosmFunctionValue("optional", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Schema.optional expects a class receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: Schema.optional expects 1 arguments, got ${args.length}`);
        }
        const [inner] = args;
        const innerSchema = this.expectSchema(inner, "Schema.optional");
        return new CosmSchemaValue("optional", { inner: innerSchema }, selfValue, selfValue.classRef);
      }),
    },
  };

  static bootClassMethods(): Record<string, CosmFunctionValue> {
    return manifestClassMethods(CosmSchemaValue.manifest);
  }

  constructor(
    public readonly schemaKind: SchemaKind,
    private readonly schemaState: Record<string, CosmValue>,
    classRef?: CosmClassValue,
    private readonly errorClassRef?: CosmClassValue,
  ) {
    super("Schema", {}, classRef);
  }

  private static expectSchema(value: CosmValue, context: string): CosmSchemaValue {
    if (!(value instanceof CosmSchemaValue)) {
      throw new Error(`Type error: ${context} expects a Schema argument`);
    }
    return value;
  }

  private static expectSchemaFields(value: CosmValue): Record<string, CosmValue> {
    const entries = value instanceof CosmHashValue
      ? value.entries
      : value instanceof CosmNamespaceValue
        ? value.fields
        : value instanceof CosmObjectValue
          ? value.fields
          : undefined;
    if (!entries) {
      throw new Error("Type error: Schema.object expects a hash, namespace, or object of field schemas");
    }
    for (const [key, entry] of Object.entries(entries)) {
      if (!(entry instanceof CosmSchemaValue)) {
        throw new Error(`Type error: Schema.object field '${key}' must be a Schema`);
      }
    }
    return entries;
  }

  private fail(message: string, details?: CosmValue): never {
    CosmErrorValue.raise(new CosmStringValue(message), this.errorClassRef, details);
  }

  private validateValue(value: CosmValue, path: string): void {
    switch (this.schemaKind) {
      case "string":
        if (!(value instanceof CosmStringValue)) {
          this.fail(`Schema validation failed at ${path}: expected string, got ${value.type}`);
        }
        return;
      case "number":
        if (!(value instanceof CosmNumberValue)) {
          this.fail(`Schema validation failed at ${path}: expected number, got ${value.type}`);
        }
        return;
      case "boolean":
        if (!(value instanceof CosmBoolValue)) {
          this.fail(`Schema validation failed at ${path}: expected boolean, got ${value.type}`);
        }
        return;
      case "optional":
        if (value instanceof CosmBoolValue && value.value === false) {
          return;
        }
        this.expectInnerSchema("optional").validateValue(value, path);
        return;
      case "array":
        if (!(value instanceof CosmArrayValue)) {
          this.fail(`Schema validation failed at ${path}: expected array, got ${value.type}`);
        }
        value.items.forEach((item, index) => this.expectItemSchema().validateValue(item, `${path}[${index}]`));
        return;
      case "enum": {
        const options = this.expectOptions();
        const matched = options.items.some((option) => ValueAdapter.format(option) === ValueAdapter.format(value));
        if (!matched) {
          this.fail(`Schema validation failed at ${path}: expected one of ${ValueAdapter.format(options)}, got ${ValueAdapter.format(value)}`);
        }
        return;
      }
      case "object": {
        const entries = this.extractEntries(value, path);
        for (const [key, schema] of Object.entries(this.expectFieldSchemas().fields)) {
          (schema as CosmSchemaValue).validateValue(entries[key] ?? Construct.bool(false), `${path}.${key}`);
        }
        return;
      }
    }
  }

  private castValue(value: CosmValue, path: string): CosmValue {
    switch (this.schemaKind) {
      case "string":
        if (value instanceof CosmStringValue) {
          return value;
        }
        return this.fail(`Schema cast failed at ${path}: expected string, got ${value.type}`);
      case "number":
        if (value instanceof CosmNumberValue) {
          return value;
        }
        if (value instanceof CosmStringValue) {
          const parsed = Number(value.value);
          if (Number.isFinite(parsed)) {
            return new CosmNumberValue(parsed);
          }
        }
        return this.fail(`Schema cast failed at ${path}: expected number-like value, got ${value.type}`);
      case "boolean":
        if (value instanceof CosmBoolValue) {
          return value;
        }
        if (value instanceof CosmStringValue && (value.value === "true" || value.value === "false")) {
          return new CosmBoolValue(value.value === "true");
        }
        return this.fail(`Schema cast failed at ${path}: expected boolean-like value, got ${value.type}`);
      case "optional":
        if (value instanceof CosmBoolValue && value.value === false) {
          return value;
        }
        return this.expectInnerSchema("optional").castValue(value, path);
      case "array":
        if (!(value instanceof CosmArrayValue)) {
          this.fail(`Schema cast failed at ${path}: expected array, got ${value.type}`);
        }
        return new CosmArrayValue(value.items.map((item, index) => this.expectItemSchema().castValue(item, `${path}[${index}]`)));
      case "enum":
        this.validateValue(value, path);
        return value;
      case "object": {
        const entries = this.extractEntries(value, path);
        const casted: Record<string, CosmValue> = {};
        for (const [key, schema] of Object.entries(this.expectFieldSchemas().fields)) {
          casted[key] = (schema as CosmSchemaValue).castValue(entries[key] ?? Construct.bool(false), `${path}.${key}`);
        }
        return new CosmHashValue(casted);
      }
    }
  }

  private extractEntries(value: CosmValue, path: string): Record<string, CosmValue> {
    if (value instanceof CosmHashValue) {
      return value.entries;
    }
    if (value instanceof CosmNamespaceValue || value instanceof CosmObjectValue) {
      return value.fields;
    }
    this.fail(`Schema validation failed at ${path}: expected object-like value, got ${value.type}`);
  }

  private expectItemSchema(): CosmSchemaValue {
    const item = this.schemaState.item;
    if (!(item instanceof CosmSchemaValue)) {
      this.fail("Schema runtime error: missing item schema for array");
    }
    return item;
  }

  private expectInnerSchema(context: string): CosmSchemaValue {
    const inner = this.schemaState.inner;
    if (!(inner instanceof CosmSchemaValue)) {
      this.fail(`Schema runtime error: missing inner schema for ${context}`);
    }
    return inner;
  }

  private expectOptions(): CosmArrayValue {
    const options = this.schemaState.options;
    if (!(options instanceof CosmArrayValue)) {
      this.fail("Schema runtime error: missing enum options");
    }
    return options;
  }

  private expectFieldSchemas(): CosmNamespaceValue {
    const fields = this.schemaState.fields;
    if (!(fields instanceof CosmNamespaceValue)) {
      this.fail("Schema runtime error: missing object field schemas");
    }
    return fields;
  }

  private describeSchema(): string {
    switch (this.schemaKind) {
      case "string":
      case "number":
      case "boolean":
        return `Schema.${this.schemaKind}()`;
      case "optional":
        return `Schema.optional(${this.expectInnerSchema("optional").describeSchema()})`;
      case "array":
        return `Schema.array(${this.expectItemSchema().describeSchema()})`;
      case "enum":
        return `Schema.enum(${this.expectOptions().items.map((item) => ValueAdapter.format(item)).join(", ")})`;
      case "object":
        return `Schema.object({ ${Object.entries(this.expectFieldSchemas().fields).map(([key, schema]) => `${key}: ${(schema as CosmSchemaValue).describeSchema()}`).join(", ")} })`;
    }
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmSchemaValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== "inspect") {
      return inherited;
    }
    return manifestMethod(this, name, CosmSchemaValue.manifest);
  }
}
