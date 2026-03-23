import { RuntimeValueManifest, manifestClassMethods, manifestMethod, manifestProperty } from "../runtime/RuntimeManifest";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmStringValue } from "./CosmStringValue";
import { CosmArrayValue } from "./CosmArrayValue";
import { CosmValue } from "../types";
import { CosmRaisedError } from "../runtime/CosmRaisedError";
import { Construct } from "../Construct";
import { ValueAdapter } from "../ValueAdapter";

export class CosmErrorValue extends CosmObjectValue {
  static readonly manifest: RuntimeValueManifest<CosmErrorValue> = {
    properties: {
      message: (self) => new CosmStringValue(self.messageText),
      backtrace: (self) => new CosmArrayValue(self.backtraceItems.map((line) => new CosmStringValue(line))),
      details: (self) => self.detailsValue,
    },
    methods: {
      inspect: () => new CosmFunctionValue("inspect", (args, selfValue) => {
        if (!(selfValue instanceof CosmErrorValue)) {
          throw new Error("Type error: inspect expects an Error receiver");
        }
        if (args.length !== 0) {
          throw new Error(`Arity error: Error.inspect expects 0 arguments, got ${args.length}`);
        }
        return new CosmStringValue(ValueAdapter.format(selfValue));
      }),
    },
    classMethods: {
      new: () => new CosmFunctionValue("new", (args, selfValue) => {
        if (!(selfValue instanceof CosmClassValue)) {
          throw new Error("Type error: Error.new expects a class receiver");
        }
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: Error.new expects 1 or 2 arguments, got ${args.length}`);
        }
        const [message, details] = args;
        if (!(message instanceof CosmStringValue)) {
          throw new Error("Type error: Error.new expects a string message");
        }
        return new CosmErrorValue(message.value, [], details ?? Construct.bool(false), selfValue);
      }),
    },
  };

  static bootClassMethods(): Record<string, CosmFunctionValue> {
    return manifestClassMethods(CosmErrorValue.manifest);
  }

  constructor(
    public readonly messageText: string,
    public readonly backtraceItems: string[] = [],
    public readonly detailsValue: CosmValue = Construct.bool(false),
    classRef?: CosmClassValue,
  ) {
    super("Error", {}, classRef);
  }

  static fromUnknown(error: unknown, classRef?: CosmClassValue): CosmErrorValue {
    if (error instanceof CosmRaisedError) {
      return error.cosmError;
    }
    if (error instanceof CosmErrorValue) {
      return error;
    }
    if (error instanceof Error) {
      return new CosmErrorValue(error.message, [], Construct.bool(false), classRef);
    }
    return new CosmErrorValue(String(error), [], Construct.bool(false), classRef);
  }

  static raise(messageOrError: CosmValue, classRef?: CosmClassValue, details?: CosmValue): never {
    if (messageOrError instanceof CosmErrorValue) {
      throw new CosmRaisedError(messageOrError);
    }
    if (messageOrError instanceof CosmStringValue) {
      throw new CosmRaisedError(new CosmErrorValue(messageOrError.value, [], details ?? Construct.bool(false), classRef));
    }
    throw new CosmRaisedError(new CosmErrorValue(ValueAdapter.format(messageOrError), [], details ?? Construct.bool(false), classRef));
  }

  toDisplayString(): string {
    if (this.backtraceItems.length === 0) {
      return this.messageText;
    }
    return `${this.messageText}\n\nBacktrace\n${this.backtraceItems.join("\n")}`;
  }

  override nativeProperty(name: string): CosmValue | undefined {
    const inherited = super.nativeProperty(name);
    if (inherited !== undefined) {
      return inherited;
    }
    return manifestProperty(this, name, CosmErrorValue.manifest);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited && name !== "inspect") {
      return inherited;
    }
    return manifestMethod(this, name, CosmErrorValue.manifest);
  }
}
