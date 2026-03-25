import { expect, test } from "bun:test";
import { ValueAdapter } from "../../src/ValueAdapter";
import { CosmStringValue } from "../../src/values/CosmStringValue";
import { dispatchService } from "../support/request_spec";

test("module-organized app can be exercised as a request spec without listen", () => {
  const appSource = `
    require("app/app.cosm")
    app.App.build()
  `;

  const home = dispatchService(appSource, "GET", "/");
  expect(ValueAdapter.cosmToJS(home.nativeProperty?.("status"))).toBe(200);
  const homeHeaders = home.nativeProperty?.("headers");
  const contentType = homeHeaders?.nativeMethod?.("get")?.nativeCall?.([new CosmStringValue("content-type")], homeHeaders);
  expect(ValueAdapter.cosmToJS(contentType)).toBe("text/html; charset=utf-8");
  const homeBody = ValueAdapter.cosmToJS(home.nativeProperty?.("body"));
  expect(homeBody).toContain("Cosm 0.3.11");

  const notebook = dispatchService(appSource, "GET", "/notebook");
  expect(ValueAdapter.cosmToJS(notebook.nativeProperty?.("status"))).toBe(200);
  const notebookBody = ValueAdapter.cosmToJS(notebook.nativeProperty?.("body"));
  expect(notebookBody).toContain("Live eval is idle.");
  expect(notebookBody).toContain("Try the current surface");
  expect(notebookBody).toContain("Recent Snippets");
  expect(notebookBody).toContain("<details");
  expect(notebookBody).toContain("Support agent prompt");
  expect(notebookBody).toContain("require(&quot;support/agent.cosm&quot;)");

  const notebookEval = dispatchService(appSource, "POST", "/notebook/eval", { body: "code=1%20%2B%202" });
  expect(ValueAdapter.cosmToJS(notebookEval.nativeProperty?.("status"))).toBe(200);
  expect(ValueAdapter.cosmToJS(notebookEval.nativeProperty?.("body"))).toContain("3");
});

test("web-layer request specs render Cosm backtraces for notebook errors", () => {
  const notebook = dispatchService(`
    require("app/app.cosm")
    app.App.build()
  `, "POST", "/notebook/eval", { body: "code=Prompt.complete" });
  const body = ValueAdapter.cosmToJS(notebook.nativeProperty?.("body"));
  expect(body).toContain("Property error");
  expect(body).toContain("access Prompt.complete");
  expect(body).not.toContain("src/runtime/");
  expect(body).not.toContain("src/cosm.ts");
});

test("notebook results use Cosm inspect output instead of raw host formatting", () => {
  const notebook = dispatchService(`
    require("app/app.cosm")
    app.App.build()
  `, "POST", "/notebook/eval", { body: "code=Kernel" });
  const body = ValueAdapter.cosmToJS(notebook.nativeProperty?.("body"));
  expect(body).toContain("#&lt;Kernel&gt;");
});
