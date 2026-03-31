import { CosmClassValue } from "../../values/CosmClassValue";
import { CosmFunctionValue } from "../../values/CosmFunctionValue";
import { CosmKernelValue } from "../../values/CosmKernelValue";
import { CosmMethodValue } from "../../values/CosmMethodValue";
import { CosmArrayValue } from "../../values/CosmArrayValue";
import { CosmHashValue } from "../../values/CosmHashValue";
import { CosmProcessValue } from "../../values/CosmProcessValue";
import { CosmSymbolValue } from "../../values/CosmSymbolValue";
import { CosmValueBase } from "../../values/CosmValueBase";
import { CosmHttpValue } from "../../values/CosmHttpValue";
import { CosmHttpRouterValue } from "../../values/CosmHttpRouterValue";
import { CosmMirrorValue } from "../../values/CosmMirrorValue";
import { CosmHologramHandleValue } from "../../values/CosmHologramHandleValue";
import { CosmErrorValue } from "../../values/CosmErrorValue";
import { CosmAiValue } from "../../values/CosmAiValue";
import { CosmSessionValue } from "../../values/CosmSessionValue";
import { RuntimeDispatch } from "../RuntimeDispatch";
import { RuntimeEquality } from "../RuntimeEquality";
import { AiRuntime } from "../AiRuntime";
import { SessionRuntime } from "../SessionRuntime";
import { BootstrapRuntime, RuntimeRepository } from "./types";

export function installRuntimeHooks(runtime: BootstrapRuntime, getCurrentRepository: () => RuntimeRepository | undefined): void {
  const namedSessions = new Map<string, CosmSessionValue>();

  CosmKernelValue.installRuntimeHooks({
    send: (receiver, messageValue, args, env) => runtime.invokeSend(receiver, messageValue, args, env),
    invoke: (callee, args, context) => runtime.invokeFunction(callee, args, context.receiver, context.env, context.currentBlock),
    eval: (source) => runtime.evalSource(source),
    resetEval: () => runtime.resetEvalSource?.(),
    defaultSession: () => runtime.defaultSession(),
    wrapError: (error) => CosmErrorValue.fromUnknown(error, getCurrentRepository()?.classes.Error),
  });
  CosmProcessValue.installRuntimeHooks({});
  CosmFunctionValue.installRuntimeHooks({
    invoke: (callee, args, context) => runtime.invokeFunction(callee, args, context.receiver, context.env, context.currentBlock),
  });
  CosmArrayValue.installRuntimeHooks({
    invoke: (callee, args, context) => runtime.invokeFunction(callee, args, context.receiver, context.env, context.currentBlock),
  });
  CosmHashValue.installRuntimeHooks({
    invoke: (callee, args, context) => runtime.invokeFunction(callee, args, context.receiver, context.env, context.currentBlock),
  });
  CosmHttpValue.installRuntimeHooks({
    invoke: (callee, args, context) => runtime.invokeFunction(callee, args, context.receiver, context.env, context.currentBlock),
    lookupMethod: (receiver, message) => RuntimeDispatch.reflectMethod(receiver, message, getCurrentRepository()!),
  });
  CosmHttpRouterValue.installRuntimeHooks({
    invoke: (callee, args, context) => runtime.invokeFunction(callee, args, context.receiver, context.env, context.currentBlock),
    lookupMethod: (receiver, message) => RuntimeDispatch.reflectMethod(receiver, message, getCurrentRepository()!),
  });
  CosmClassValue.installRuntimeHooks({
    instantiate: (classValue, args) => runtime.instantiateClass(classValue, args),
    lookupClassMethod: (classValue, message) => RuntimeDispatch.reflectClassMethod(classValue, message),
  });
  CosmMirrorValue.installRuntimeHooks({
    classOf: (value) => runtime.classOf(value),
    lookupProperty: (receiver, property) => RuntimeDispatch.lookupProperty(receiver, property, getCurrentRepository()!),
    visibleMethods: (receiver) => RuntimeDispatch.visibleMethodSymbols(receiver, getCurrentRepository()!),
  });
  CosmHologramHandleValue.installRuntimeHooks({
    classOf: (value) => runtime.classOf(value),
  });
  CosmMethodValue.installRuntimeHooks({
    invoke: (callee, args, context) => runtime.invokeFunction(callee, args, context.receiver, context.env, context.currentBlock),
  });
  CosmSymbolValue.installRuntimeHooks({
    intern: (name) => runtime.internSymbol(name),
    send: (receiver, message, args, env) => runtime.invokeSend(receiver, runtime.internSymbol(message), args, env),
  });
  CosmValueBase.installRuntimeHooks({
    send: (receiver, messageValue, args, env) => runtime.invokeSend(receiver, messageValue, args, env),
    lookupMethod: (receiver, message) => RuntimeDispatch.reflectMethod(receiver, message, getCurrentRepository()!),
    lookupMethods: (receiver) => RuntimeDispatch.visibleMethodSymbols(receiver, getCurrentRepository()!),
    classOf: (receiver) => runtime.classOf(receiver),
    equal: (left, right) => RuntimeEquality.compare(left, right),
  });
  CosmAiValue.installRuntimeHooks({
    status: () => AiRuntime.status(getCurrentRepository()?.classes.Namespace),
    health: () => AiRuntime.health(getCurrentRepository()?.classes.Namespace),
    complete: (prompt) => AiRuntime.complete(prompt),
    cast: (prompt, schema) => AiRuntime.cast(prompt, schema),
    chatCast: (messages, schema) => AiRuntime.chatCast(messages, schema),
    compare: (left, right) => AiRuntime.compare(left, right),
    resolve: (prompt, options) => AiRuntime.resolve(prompt, options),
    stream: (prompt, onEvent) => AiRuntime.stream(prompt, onEvent),
    invoke: (callee, args, context) => runtime.invokeFunction(callee, args, context.receiver, context.env, context.currentBlock),
  });
  CosmSessionValue.installRuntimeHooks({
    createHandle: (name, errorClassRef) => SessionRuntime.createHandle({
      name,
      errorClassRef,
      evalInEnv: (source, env) => runtime.evalInEnv(source, env),
      inspectValue: (value, env) => runtime.inspectValue(value, env),
      createEnv: () => runtime.createSessionEnv(),
      inline: name === "example"
        || ((name.startsWith("slack-") || name.startsWith("agent:"))
          && (process.env.AGENT_INLINE_SESSION === "1" || process.env.COSM_SLACK_INLINE_SESSION === "1")),
    }),
    defaultSession: () => runtime.defaultSession() as CosmSessionValue,
    namedSession: (name) => {
      let existing = namedSessions.get(name);
      if (!existing) {
        existing = new CosmSessionValue(name, getCurrentRepository()?.classes.Session, getCurrentRepository()?.classes.Error);
        namedSessions.set(name, existing);
      }
      return existing;
    },
  });
}
