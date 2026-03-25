import { CosmEnv, CosmValue } from "../types";
import { RuntimeDispatch, RuntimeRepository } from "./RuntimeDispatch";
import { InterpreterLookup } from "./InterpreterLookup";

type MessageHooks = {
  invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv, currentBlock?: CosmValue) => CosmValue;
  withFrame: <T>(frame: string, fn: () => T) => T;
  repository: RuntimeRepository;
};

export class InterpreterMessage {
  static send(receiver: CosmValue, message: string, args: CosmValue[], env: CosmEnv | undefined, hooks: MessageHooks): CosmValue {
    const currentBlock = env ? InterpreterLookup.findCurrentBlock(env) : undefined;
    return hooks.withFrame(`send ${this.describeValue(receiver)}.${message}`, () =>
      RuntimeDispatch.send(receiver, message, args, hooks.repository, (callee, invokeArgs, selfValue, scope) =>
        hooks.invokeFunction(callee, invokeArgs, selfValue, scope, currentBlock),
      ),
    );
  }

  static invokeSend(receiver: CosmValue, messageValue: CosmValue, args: CosmValue[], env: CosmEnv | undefined, hooks: MessageHooks): CosmValue {
    const currentBlock = env ? InterpreterLookup.findCurrentBlock(env) : undefined;
    return hooks.withFrame(`send ${this.describeValue(receiver)}.${RuntimeDispatch.messageName(messageValue)}`, () =>
      RuntimeDispatch.invokeSend(receiver, messageValue, args, hooks.repository, (callee, invokeArgs, selfValue, scope) =>
        hooks.invokeFunction(callee, invokeArgs, selfValue, scope, currentBlock),
        env,
      ),
    );
  }

  static describeValue(value: CosmValue): string {
    switch (value.type) {
      case "class":
        return value.name;
      case "object":
        return value.className;
      case "function":
        return value.name;
      case "method":
        return `${this.describeValue(value.receiver)}.${value.name}`;
      case "string":
        return JSON.stringify(value.value);
      case "symbol":
        return `:${value.name}`;
      default:
        return value.type;
    }
  }
}
