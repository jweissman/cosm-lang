import { Construct } from "../../Construct";
import { CosmClass, CosmFunction } from "../../types";

function createBootClass(name: string, superclass: CosmClass, classClass: CosmClass): CosmClass {
  const classValue = Construct.class(name, superclass.name, [], {}, {}, superclass);
  classValue.classRef = createMetaclass(name, superclass.classRef ?? classClass, {}, classClass);
  return classValue;
}

export function createMetaclass(
  name: string,
  superclassMeta: CosmClass,
  methods: Record<string, CosmFunction>,
  classClass: CosmClass,
): CosmClass {
  return Construct.class(`${name} class`, superclassMeta.name, [], methods, {}, superclassMeta, classClass);
}

export function createCoreClasses(): Record<string, CosmClass> {
  const basicObjectClass = Construct.class("BasicObject");
  const objectClass = Construct.class("Object", "BasicObject", [], {}, {}, basicObjectClass);
  const moduleClass = Construct.class("Module", "Object", [], {}, {}, objectClass);
  const classClass = Construct.class("Class", "Module", [], {}, {}, moduleClass);
  classClass.classRef = classClass;
  basicObjectClass.classRef = createMetaclass("BasicObject", classClass, {}, classClass);
  objectClass.classRef = createMetaclass("Object", basicObjectClass.classRef ?? classClass, {}, classClass);
  moduleClass.classRef = createMetaclass("Module", objectClass.classRef ?? classClass, {}, classClass);

  const classes: Record<string, CosmClass> = {
    BasicObject: basicObjectClass,
    Class: classClass,
    Module: moduleClass,
    Object: objectClass,
  };

  for (const name of [
    "Number",
    "Boolean",
    "Nihil",
    "String",
    "Symbol",
    "Array",
    "Hash",
    "Function",
    "Method",
    "HostObject",
    "Namespace",
    "Kernel",
    "Process",
    "Time",
    "Random",
    "Mirror",
    "HologramHandle",
    "Error",
    "Schema",
    "Prompt",
    "Ai",
    "Session",
    "DataModel",
    "Http",
    "HttpRequest",
    "HttpResponse",
    "HttpServer",
    "HttpRouter",
  ]) {
    classes[name] = createBootClass(name, objectClass, classClass);
  }

  return classes;
}
