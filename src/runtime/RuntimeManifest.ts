import { CosmValue } from "../types";
import { CosmFunctionValue } from "../values/CosmFunctionValue";

export type RuntimeValueManifest<T extends CosmValue> = {
  properties?: Record<string, (self: T) => CosmValue | undefined>;
  methods?: Record<string, (self: T) => CosmFunctionValue>;
  classMethods?: Record<string, () => CosmFunctionValue>;
};

export function manifestProperty<T extends CosmValue>(
  self: T,
  name: string,
  manifest: RuntimeValueManifest<T>,
): CosmValue | undefined {
  return manifest.properties?.[name]?.(self);
}

export function manifestMethod<T extends CosmValue>(
  self: T,
  name: string,
  manifest: RuntimeValueManifest<T>,
): CosmFunctionValue | undefined {
  return manifest.methods?.[name]?.(self);
}

export function manifestMethods<T extends CosmValue>(
  self: T,
  manifest: RuntimeValueManifest<T>,
): Record<string, CosmFunctionValue> {
  return Object.fromEntries(
    Object.entries(manifest.methods ?? {}).map(([name, factory]) => [name, factory(self)]),
  );
}

export function manifestClassMethods<T extends CosmValue>(
  manifest: RuntimeValueManifest<T>,
): Record<string, CosmFunctionValue> {
  return Object.fromEntries(
    Object.entries(manifest.classMethods ?? {}).map(([name, factory]) => [name, factory()]),
  );
}
