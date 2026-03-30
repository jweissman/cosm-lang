import { Construct } from "../../Construct";
import { manifestClassMethods, manifestMethods } from "../RuntimeManifest";
import { CosmAiValue } from "../../values/CosmAiValue";
import { CosmClassValue } from "../../values/CosmClassValue";
import { CosmDataModelValue } from "../../values/CosmDataModelValue";
import { CosmErrorValue } from "../../values/CosmErrorValue";
import { CosmFunctionValue } from "../../values/CosmFunctionValue";
import { CosmHostObjectValue } from "../../values/CosmHostObjectValue";
import { CosmHologramHandleValue } from "../../values/CosmHologramHandleValue";
import { CosmHttpRequestValue } from "../../values/CosmHttpRequestValue";
import { CosmHttpResponseValue } from "../../values/CosmHttpResponseValue";
import { CosmHttpRouterValue } from "../../values/CosmHttpRouterValue";
import { CosmHttpServerValue } from "../../values/CosmHttpServerValue";
import { CosmHttpValue } from "../../values/CosmHttpValue";
import { CosmKernelValue } from "../../values/CosmKernelValue";
import { CosmMethodValue } from "../../values/CosmMethodValue";
import { CosmMirrorValue } from "../../values/CosmMirrorValue";
import { CosmModuleValue } from "../../values/CosmModuleValue";
import { CosmNihilValue } from "../../values/CosmNihilValue";
import { CosmNamespaceValue } from "../../values/CosmNamespaceValue";
import { CosmObjectValue } from "../../values/CosmObjectValue";
import { CosmProcessValue } from "../../values/CosmProcessValue";
import { CosmPromptValue } from "../../values/CosmPromptValue";
import { CosmRandomValue } from "../../values/CosmRandomValue";
import { CosmSchemaValue } from "../../values/CosmSchemaValue";
import { CosmSessionValue } from "../../values/CosmSessionValue";
import { CosmSymbolValue } from "../../values/CosmSymbolValue";
import { CosmTimeValue } from "../../values/CosmTimeValue";
import { CosmValueBase } from "../../values/CosmValueBase";
import { BootClasses } from "./types";

export function installBootNativeMethods(classes: BootClasses): void {
  Object.assign(classes.BasicObject.methods, manifestMethods(
    new CosmObjectValue("BasicObject", {}, classes.BasicObject),
    CosmValueBase.basicManifest,
  ));
  Object.assign(classes.Object.methods, manifestMethods(
    new CosmObjectValue("Object", {}, classes.Object),
    CosmValueBase.objectManifest,
  ));
  Object.assign(classes.Class.methods, manifestMethods(classes.Class, CosmClassValue.manifest));
  Object.assign(classes.Function.methods, manifestMethods(
    new CosmFunctionValue("noop", () => Construct.bool(true)),
    CosmFunctionValue.manifest,
  ));
  Object.assign(classes.Method.methods, manifestMethods(
    Construct.method("noop", Construct.bool(true), new CosmFunctionValue("noop", () => Construct.bool(true))),
    CosmMethodValue.manifest,
  ));
  Object.assign(classes.HostObject.methods, manifestMethods(
    new CosmHostObjectValue({}, {
      kind: "example.host",
      inspect: () => "#<HostObject example.host>",
      keys: () => [],
      has: () => false,
      get: () => undefined,
    }, classes.HostObject),
    CosmHostObjectValue.manifest,
  ));
  Object.assign(classes.Symbol.methods, manifestMethods(
    Construct.symbol("example"),
    CosmSymbolValue.manifest,
  ));
  Object.assign(classes.Nihil.methods, manifestMethods(
    new CosmNihilValue(),
    CosmValueBase.objectManifest,
  ));
  Object.assign(classes.Namespace.methods, manifestMethods(
    new CosmNamespaceValue({}, classes.Namespace),
    CosmNamespaceValue.manifest,
  ));
  Object.assign(classes.Module.methods, manifestMethods(
    new CosmModuleValue("example/module", {}, classes.Module),
    CosmModuleValue.manifest,
  ));
  Object.assign(classes.Kernel.methods, manifestMethods(
    new CosmKernelValue({}, classes.Kernel),
    CosmKernelValue.manifest,
  ));
  Object.assign(classes.Process.methods, manifestMethods(
    new CosmProcessValue({}, classes.Process),
    CosmProcessValue.manifest,
  ));
  Object.assign(classes.Time.methods, manifestMethods(
    new CosmTimeValue({}, classes.Time),
    CosmTimeValue.manifest,
  ));
  Object.assign(classes.Random.methods, manifestMethods(
    new CosmRandomValue({}, classes.Random),
    CosmRandomValue.manifest,
  ));
  Object.assign(classes.Mirror.methods, manifestMethods(
    new CosmMirrorValue(Construct.bool(true), classes.Mirror),
    CosmMirrorValue.manifest,
  ));
  Object.assign(classes.HologramHandle.methods, manifestMethods(
    CosmHologramHandleValue.wrap(Construct.hash({}), classes.HologramHandle),
    CosmHologramHandleValue.manifest,
  ));
  Object.assign(classes.Error.methods, manifestMethods(
    new CosmErrorValue("example", [], Construct.bool(false), classes.Error),
    CosmErrorValue.manifest,
  ));
  Object.assign(classes.Schema.methods, manifestMethods(
    new CosmSchemaValue("string", {}, classes.Schema, classes.Error),
    CosmSchemaValue.manifest,
  ));
  Object.assign(classes.Prompt.methods, manifestMethods(
    new CosmPromptValue("example", classes.Prompt),
    CosmPromptValue.manifest,
  ));
  Object.assign(classes.Ai.methods, manifestMethods(
    new CosmAiValue({}, classes.Ai, classes.Error),
    CosmAiValue.manifest,
  ));
  Object.assign(classes.Session.methods, manifestMethods(
    new CosmSessionValue("example", classes.Session, classes.Error),
    CosmSessionValue.manifest,
  ));
  Object.assign(classes.DataModel.methods, manifestMethods(
    new CosmDataModelValue("Example", {}, classes.DataModel, classes.Schema, classes.Error, classes.Namespace, {}),
    CosmDataModelValue.manifest,
  ));
  Object.assign(classes.Http.methods, manifestMethods(
    new CosmHttpValue({}, classes.Http, classes.HttpServer, classes.Namespace, classes.HostObject, classes.HttpRequest, classes.HttpResponse),
    CosmHttpValue.manifest,
  ));
  Object.assign(classes.HttpRequest.methods, manifestMethods(
    new CosmHttpRequestValue(
      "GET",
      "http://127.0.0.1:0/example",
      "/example",
      new CosmNamespaceValue({}, classes.Namespace),
      new CosmNamespaceValue({}, classes.Namespace),
      "",
      classes.HttpRequest,
    ),
    CosmHttpRequestValue.manifest,
  ));
  Object.assign(classes.HttpResponse.methods, manifestMethods(
    new CosmHttpResponseValue(200, Construct.string("ok"), new CosmNamespaceValue({}, classes.Namespace), classes.HttpResponse),
    CosmHttpResponseValue.manifest,
  ));
  Object.assign(classes.HttpServer.methods, manifestMethods(
    new CosmHttpServerValue(undefined, 0, "", classes.HttpServer),
    CosmHttpServerValue.manifest,
  ));
  Object.assign(classes.HttpRouter.methods, manifestMethods(
    new CosmHttpRouterValue({}, classes.HttpRouter, classes.HttpResponse, classes.Namespace),
    CosmHttpRouterValue.manifest,
  ));

  Object.assign(classes.Symbol.classRef?.methods ?? {}, manifestClassMethods(CosmSymbolValue.manifest));
  Object.assign(classes.HttpResponse.classRef?.methods ?? {}, manifestClassMethods(CosmHttpResponseValue.manifest));
  Object.assign(classes.Mirror.classRef?.methods ?? {}, CosmMirrorValue.bootClassMethods());
  Object.assign(classes.HologramHandle.classRef?.methods ?? {}, CosmHologramHandleValue.bootClassMethods());
  Object.assign(classes.Error.classRef?.methods ?? {}, CosmErrorValue.bootClassMethods());
  Object.assign(classes.Schema.classRef?.methods ?? {}, CosmSchemaValue.bootClassMethods());
  Object.assign(classes.Prompt.classRef?.methods ?? {}, CosmPromptValue.bootClassMethods());
  Object.assign(classes.Session.classRef?.methods ?? {}, CosmSessionValue.bootClassMethods());
}
