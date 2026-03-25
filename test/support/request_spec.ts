import Cosm from "../../src/cosm";
import { CosmHttpRequestValue } from "../../src/values/CosmHttpRequestValue";
import { CosmNamespaceValue } from "../../src/values/CosmNamespaceValue";
import { CosmStringValue } from "../../src/values/CosmStringValue";

export const dispatchService = (
  serviceSource: string,
  method: string,
  path: string,
  options?: {
    body?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  },
) => {
  const serviceValue = Cosm.Interpreter.eval(serviceSource);
  const queryString = options?.query
    ? `?${new URLSearchParams(options.query).toString()}`
    : "";
  const requestValue = new CosmHttpRequestValue(
    method,
    `http://127.0.0.1${path}${queryString}`,
    path,
    new CosmNamespaceValue(
      Object.fromEntries(
        Object.entries(options?.headers ?? {}).map(([key, value]) => [key.toLowerCase(), new CosmStringValue(value)]),
      ),
    ),
    new CosmNamespaceValue(
      Object.fromEntries(
        Object.entries(options?.query ?? {}).map(([key, value]) => [key, new CosmStringValue(value)]),
      ),
    ),
    options?.body ?? "",
  );
  const handleMethod = (Cosm.Interpreter as unknown as {
    lookupProperty: (receiver: unknown, property: string) => unknown;
    invokeFunction: (callee: unknown, args: unknown[]) => unknown;
  }).lookupProperty(serviceValue, "handle");
  return (Cosm.Interpreter as unknown as {
    invokeFunction: (callee: unknown, args: unknown[]) => unknown;
  }).invokeFunction(handleMethod, [requestValue]);
};
