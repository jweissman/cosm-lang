import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { RuntimeInspect } from "../runtime/RuntimeInspect";
import { CosmClassValue } from "./CosmClassValue";
import { CosmDataModelValue } from "./CosmDataModelValue";
import { CosmEnumTagValue } from "./CosmEnumTagValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmHashValue } from "./CosmHashValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmSchemaValue } from "./CosmSchemaValue";
import { CosmStringValue } from "./CosmStringValue";

export class CosmDataRecordValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmDataRecordValue> = {
    properties: {
      model: (self) => self.modelValue,
    },
    methods: {
      at: () => new CosmFunctionValue("at", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataRecordValue)) {
          throw new Error("Type error: at expects a DataRecord receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: DataRecord.at expects 1 arguments, got ${args.length}`);
        }
        const [key] = args;
        const fieldName = key instanceof CosmStringValue
          ? key.value
          : key.type === "symbol"
            ? key.name
            : undefined;
        if (!fieldName) {
          throw new Error("Type error: DataRecord.at expects a string or symbol key");
        }
        return selfValue.readField(fieldName);
      }),
      to_h: () => new CosmFunctionValue("to_h", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataRecordValue)) {
          throw new Error("Type error: to_h expects a DataRecord receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: DataRecord.to_h expects 0 arguments, got ${args.length}`);
        }
        return new CosmHashValue({ ...selfValue.fields });
      }),
      inspect: () => new CosmFunctionValue("inspect", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataRecordValue)) {
          throw new Error("Type error: inspect expects a DataRecord receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: DataRecord.inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(selfValue.inspectText());
      }),
      to_s: () => new CosmFunctionValue("to_s", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataRecordValue)) {
          throw new Error("Type error: to_s expects a DataRecord receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: DataRecord.to_s expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(selfValue.inspectText());
      }),
    },
  };

  constructor(
    public readonly modelValue: CosmDataModelValue,
    fields: Record<string, CosmValue>,
    classRef?: CosmClassValue,
    private readonly enumTagClassRef?: CosmClassValue,
  ) {
    super("DataRecord", fields, classRef);
  }

  readField(name: string): CosmValue {
    const value = this.fields[name];
    if (value === undefined) {
      throw new Error(`Property error: model ${this.modelValue.modelName} has no field '${name}'`);
    }
    return this.wrapField(name, value);
  }

  private wrapField(name: string, value: CosmValue): CosmValue {
    const schema = this.modelValue.fieldSchema(name);
    const enumSchema = schema ? this.enumSchema(schema) : undefined;
    if (!enumSchema || !(value instanceof CosmStringValue)) {
      return value;
    }
    return new CosmEnumTagValue(
      value.value,
      enumSchema.optionValues(),
      this.enumTagClassRef,
    );
  }

  private enumSchema(schema: CosmSchemaValue): CosmSchemaValue | undefined {
    if (schema.schemaKind === "enum") {
      return schema;
    }
    if (schema.schemaKind === "optional") {
      const inner = schema.innerSchema();
      return inner?.schemaKind === "enum" ? inner : undefined;
    }
    return undefined;
  }

  inspectText(): string {
    const entries = Object.entries(this.fields)
      .map(([key, value]) => `${key}: ${RuntimeInspect.format(this.wrapField(key, value))}`)
      .join(", ");
    return entries.length > 0
      ? `#<Data::Record ${this.modelValue.modelName} ${entries}>`
      : `#<Data::Record ${this.modelValue.modelName}>`;
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined && !Object.hasOwn(this.fields, name)) {
      return inherited;
    }
    if (Object.hasOwn(this.fields, name)) {
      return this.readField(name);
    }
    return manifestProperty(this, name, CosmDataRecordValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmDataRecordValue.manifest);
  }

  override visibleNativeMethodNames(): string[] {
    return [...super.visibleNativeMethodNames(), "at", "to_h"];
  }
}
