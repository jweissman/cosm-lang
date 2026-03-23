import { Construct } from "../Construct";
import { CosmClass, CosmFunction, CosmValue, CosmEnv } from "../types";

export type RuntimeRepository = {
  globals: Record<string, CosmValue>;
  classes: Record<string, CosmClass>;
};

export class RuntimeDispatch {
  static lookupProperty(receiver: CosmValue, property: string, repository: RuntimeRepository): CosmValue {
    const nativeProperty = receiver.nativeProperty(property);
    if (nativeProperty !== undefined) {
      return nativeProperty;
    }

    const nativeMethod = receiver.nativeMethod(property);
    if (nativeMethod) {
      return this.bindMethod(receiver, nativeMethod);
    }

    switch (receiver.type) {
      case 'array': {
        const method = this.lookupMethod(this.classOf(receiver, repository.classes), property);
        if (method) {
          return this.bindMethod(receiver, method);
        }
        throw new Error(`Property error: Array instance has no property '${property}'`);
      }
      case 'hash': {
        const method = this.lookupMethod(this.classOf(receiver, repository.classes), property);
        if (method) {
          return this.bindMethod(receiver, method);
        }
        throw new Error(`Property error: Hash instance has no property '${property}'`);
      }
      case 'object': {
        const method = this.lookupMethod(this.classOf(receiver, repository.classes), property);
        if (method) {
          return this.bindMethod(receiver, method);
        }
        throw new Error(`Property error: object of class ${receiver.className} has no property '${property}'`);
      }
      case 'class': {
        const method = this.lookupMethod(this.classOf(receiver, repository.classes), property);
        if (method) {
          return this.bindMethod(receiver, method);
        }
        throw new Error(`Property error: class ${receiver.name} has no property '${property}'`);
      }
      case 'function': {
        const method = this.lookupMethod(this.classOf(receiver, repository.classes), property);
        if (method) {
          return this.bindMethod(receiver, method);
        }
        throw new Error(`Property error: function ${receiver.name} has no property '${property}'`);
      }
      default: {
        const classValue = this.classOf(receiver, repository.classes);
        const method = this.lookupMethod(classValue, property);
        if (method) {
          return this.bindMethod(receiver, method);
        }
        throw new Error(`Property error: ${classValue.name} instance has no property '${property}'`);
      }
    }
  }

  static classOf(value: CosmValue, classes: Record<string, CosmClass>): CosmClass {
    switch (value.type) {
      case 'number':
        return classes.Number;
      case 'bool':
        return classes.Boolean;
      case 'string':
        return classes.String;
      case 'symbol':
        return classes.Symbol;
      case 'array':
        return classes.Array;
      case 'hash':
        return classes.Hash;
      case 'object':
        return value.classRef ?? classes[value.className];
      case 'class':
        return value.classRef ?? classes.Class;
      case 'function':
        return classes.Function;
      case 'method':
        return classes.Method;
    }
  }

  static lookupMethod(classValue: CosmClass, name: string): CosmFunction | undefined {
    return classValue.lookupInstanceMethod(name);
  }

  static bindMethod(receiver: CosmValue, method: CosmFunction): CosmValue {
    return Construct.method(method.name, receiver, method);
  }

  static reflectMethod(receiver: CosmValue, messageValue: CosmValue, repository: RuntimeRepository): CosmValue {
    const message = this.messageName(messageValue);
    if (receiver.type === 'class') {
      const method = this.lookupMethod(receiver, message);
      if (!method) {
        throw new Error(`Property error: class ${receiver.name} has no instance method '${message}'`);
      }
      return this.bindMethod(receiver, method);
    }
    const candidate = this.lookupProperty(receiver, message, repository);
    if (candidate.type !== 'function' && candidate.type !== 'method') {
      throw new Error(`Type error: property '${message}' is not a method`);
    }
    return candidate;
  }

  static reflectClassMethod(classValue: CosmClass, messageValue: CosmValue, _repository: RuntimeRepository): CosmValue {
    const message = this.messageName(messageValue);
    const method = classValue.lookupClassSideMethod(message);
    if (!method) {
      throw new Error(`Property error: class ${classValue.name} has no class method '${message}'`);
    }
    return this.bindMethod(classValue, method);
  }

  static send(
    receiver: CosmValue,
    message: string,
    args: CosmValue[],
    repository: RuntimeRepository,
    invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue,
  ): CosmValue {
    try {
      const method = this.resolveSendTarget(receiver, message, repository);
      return invokeFunction(method, args, receiver);
    } catch (error) {
      const missingHandler = this.lookupMissingMethodHandler(receiver, repository);
      if (missingHandler) {
        return invokeFunction(
          missingHandler,
          [Construct.symbol(message), Construct.array(args)],
          receiver,
        );
      }
      throw error;
    }
  }

  static invokeSend(
    receiver: CosmValue,
    messageValue: CosmValue,
    args: CosmValue[],
    repository: RuntimeRepository,
    invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue,
  ): CosmValue {
    return this.send(receiver, this.messageName(messageValue), args, repository, invokeFunction);
  }

  static resolveSendTarget(
    receiver: CosmValue,
    message: string,
    repository: RuntimeRepository,
  ): CosmValue {
    try {
      return this.lookupProperty(receiver, message, repository);
    } catch (error) {
      if (
        receiver.type === 'class'
        && error instanceof Error
        && error.message === `Property error: class ${receiver.name} has no property '${message}'`
      ) {
        const instanceMethod = receiver.lookupInstanceMethod(message);
        if (instanceMethod) {
          return this.bindMethod(receiver, instanceMethod);
        }
      }
      throw error;
    }
  }

  private static lookupMissingMethodHandler(receiver: CosmValue, repository: RuntimeRepository): CosmValue | undefined {
    const fallback = this.lookupMethod(this.classOf(receiver, repository.classes), 'does_not_understand');
    if (!fallback) {
      return undefined;
    }
    return this.bindMethod(receiver, fallback);
  }

  static messageName(messageValue: CosmValue): string {
    switch (messageValue.type) {
      case 'symbol':
        return messageValue.name;
      case 'string':
        return messageValue.value;
      default:
        throw new Error(`Type error: send expects a string or symbol message, got ${messageValue.type}`);
    }
  }
}
