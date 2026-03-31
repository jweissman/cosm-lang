import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmSchemaValue } from "./CosmSchemaValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmHashValue } from "./CosmHashValue";
import { CosmDataRecordValue } from "./CosmDataRecordValue";
import { CosmEnumTagValue } from "./CosmEnumTagValue";

export class CosmDataModelValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmDataModelValue> = {
    properties: {
      name: (self) => new CosmStringValue(self.modelName),
      fields: (self) => new CosmNamespaceValue(self.fieldSchemas, self.namespaceClassRef),
      length: (self) => new CosmNumberValue(Object.keys(self.fieldSchemas).length),
      defaults: (self) => new CosmHashValue({ ...self.fieldDefaults }),
    },
    methods: {
      schema: () => new CosmFunctionValue("schema", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataModelValue)) {
          throw new Error("Type error: schema expects a DataModel receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: DataModel.schema expects 0 arguments, got ${args.length}`);
        }
        return selfValue.toSchema();
      }),
      validate: () => new CosmFunctionValue("validate", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataModelValue)) {
          throw new Error("Type error: validate expects a DataModel receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: DataModel.validate expects 1 arguments, got ${args.length}`);
        }
        const schema = selfValue.toSchema();
        return schema.nativeMethod("validate")!.nativeCall!([args[0]], schema);
      }),
      build: () => new CosmFunctionValue("build", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataModelValue)) {
          throw new Error("Type error: build expects a DataModel receiver");
        }
        if (args.length > 1) {
          throw new Error(`Arity error: DataModel.build expects 0 or 1 arguments, got ${args.length}`);
        }
        const built = selfValue.buildRecord(args[0]);
        return selfValue.validateAndReturn(built);
      }),
      with_defaults: () => new CosmFunctionValue("with_defaults", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataModelValue)) {
          throw new Error("Type error: with_defaults expects a DataModel receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: DataModel.with_defaults expects 1 arguments, got ${args.length}`);
        }
        const defaults = selfValue.expectEntries(args[0], "DataModel.with_defaults");
        return new CosmDataModelValue(
          selfValue.modelName,
          selfValue.fieldSchemas,
          selfValue.classRef,
          selfValue.schemaClassRef,
          selfValue.errorClassRef,
          selfValue.namespaceClassRef,
          selfValue.recordClassRef,
          selfValue.enumTagClassRef,
          { ...selfValue.fieldDefaults, ...defaults },
        );
      }),
      jsonSchema: () => new CosmFunctionValue("jsonSchema", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataModelValue)) {
          throw new Error("Type error: jsonSchema expects a DataModel receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: DataModel.jsonSchema expects 0 arguments, got ${args.length}`);
        }
        const schema = selfValue.toSchema();
        return schema.nativeMethod("jsonSchema")!.nativeCall!([], schema);
      }),
      inspect: () => new CosmFunctionValue("inspect", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataModelValue)) {
          throw new Error("Type error: inspect expects a DataModel receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: DataModel.inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(`#<Data::Model ${JSON.stringify(selfValue.modelName)}>`);
      }),
      to_s: () => new CosmFunctionValue("to_s", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataModelValue)) {
          throw new Error("Type error: to_s expects a DataModel receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: DataModel.to_s expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(`#<Data::Model ${selfValue.modelName}>`);
      }),
    },
  };

  constructor(
    public readonly modelName: string,
    private readonly fieldSchemas: Record<string, CosmSchemaValue>,
    classRef?: CosmClassValue,
    private readonly schemaClassRef?: CosmClassValue,
    private readonly errorClassRef?: CosmClassValue,
    private readonly namespaceClassRef?: CosmClassValue,
    private readonly recordClassRef?: CosmClassValue,
    private readonly enumTagClassRef?: CosmClassValue,
    private readonly fieldDefaults: Record<string, CosmValue> = {},
  ) {
    super("DataModel", {}, classRef);
  }

  toSchema(): CosmSchemaValue {
    return new CosmSchemaValue(
      "object",
      { fields: new CosmNamespaceValue(this.fieldSchemas, this.namespaceClassRef) },
      this.schemaClassRef,
      this.errorClassRef,
    );
  }

  validateAndReturn(value: CosmValue): CosmValue {
    const validated = this.toSchema().validateAndReturn(value);
    const entries = this.expectEntries(validated, "DataModel.validate");
    return new CosmDataRecordValue(this, entries, this.recordClassRef, this.enumTagClassRef);
  }

  fieldSchema(name: string): CosmSchemaValue | undefined {
    return this.fieldSchemas[name];
  }

  private buildRecord(value?: CosmValue): CosmHashValue {
    const provided = value === undefined
      ? {}
      : this.expectEntries(value, "DataModel.build");
    const normalized = Object.fromEntries(
      Object.entries(provided).map(([key, entry]) => [key, this.normalizeFieldValue(key, entry)]),
    );
    return new CosmHashValue({
      ...this.fieldDefaults,
      ...normalized,
    });
  }

  private normalizeFieldValue(name: string, value: CosmValue): CosmValue {
    const schema = this.fieldSchemas[name];
    if (!schema) {
      return value;
    }
    if (value instanceof CosmEnumTagValue) {
      return new CosmStringValue(value.literal);
    }
    if (value.type === "symbol" && this.acceptsTextValue(schema)) {
      return new CosmStringValue(value.name);
    }
    return value;
  }

  private acceptsTextValue(schema: CosmSchemaValue): boolean {
    if (schema.schemaKind === "string" || schema.schemaKind === "enum") {
      return true;
    }
    if (schema.schemaKind === "optional") {
      const inner = schema.innerSchema();
      return inner ? this.acceptsTextValue(inner) : false;
    }
    return false;
  }

  private expectEntries(value: CosmValue, context: string): Record<string, CosmValue> {
    if (value instanceof CosmHashValue) {
      return value.entries;
    }
    if (value instanceof CosmNamespaceValue || value instanceof CosmObjectValue) {
      return value.fields;
    }
    throw new Error(`Type error: ${context} expects a hash, namespace, or object`);
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmDataModelValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmDataModelValue.manifest);
  }
}
