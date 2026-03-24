import { CosmValue } from "../types";
import { RuntimeValueManifest, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmNumberValue } from "./CosmNumberValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmSchemaValue } from "./CosmSchemaValue";
import { CosmStringValue } from "./CosmStringValue";

export class CosmDataModelValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmDataModelValue> = {
    properties: {
      name: (self) => new CosmStringValue(self.modelName),
      fields: (self) => new CosmNamespaceValue(self.fieldSchemas, self.namespaceClassRef),
      length: (self) => new CosmNumberValue(Object.keys(self.fieldSchemas).length),
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
      cast: () => new CosmFunctionValue("cast", (args, selfValue) => {
        if (!(selfValue instanceof CosmDataModelValue)) {
          throw new Error("Type error: cast expects a DataModel receiver");
        }
        if (args.length !== 1) {
          throw new Error(`Arity error: DataModel.cast expects 1 arguments, got ${args.length}`);
        }
        const schema = selfValue.toSchema();
        return schema.nativeMethod("cast")!.nativeCall!([args[0]], schema);
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
