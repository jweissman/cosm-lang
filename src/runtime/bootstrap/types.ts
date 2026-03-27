import { CosmClass, CosmEnv, CosmFunction, CosmObject, CosmValue } from "../../types";

export type RuntimeRepository = {
  globals: Record<string, CosmValue>;
  classes: Record<string, CosmClass>;
  modules: Record<string, CosmObject>;
};

export type BootstrapRuntime = {
  invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv, currentBlock?: CosmValue) => CosmValue;
  instantiateClass: (classValue: CosmClass, args: CosmValue[]) => CosmObject;
  invokeSend: (receiver: CosmValue, messageValue: CosmValue, args: CosmValue[], env?: CosmEnv) => CosmValue;
  classOf: (value: CosmValue) => CosmClass;
  internSymbol: (name: string) => CosmValue;
  loadModule: (name: string, env: CosmEnv) => CosmObject | undefined;
  evalSource: (source: string) => CosmValue;
  evalInEnv: (source: string, env: CosmEnv) => CosmValue;
  inspectValue: (value: CosmValue, env?: CosmEnv) => string;
  createSessionEnv: () => CosmEnv;
  defaultSession: () => CosmValue;
  resetEvalSource?: () => void;
};

export type BootClasses = Record<string, CosmClass>;
export type BootGlobals = Record<string, CosmValue>;
export type BootModules = Record<string, CosmObject>;
export type BootNativeMethods = Record<string, CosmFunction>;
