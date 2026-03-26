import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ValueAdapter } from "../../src/ValueAdapter";
import { CosmAiValue } from "../../src/values/CosmAiValue";
import { ValueAdapter as Adapter } from "../../src/ValueAdapter";
import { dispatchService } from "../support/request_spec";

const appSource = 'require "app/app"; App::App.build()';

const withNotebookDir = <T>(callback: () => T) => {
  const previous = process.env.COSM_NOTEBOOK_DIR;
  process.env.COSM_NOTEBOOK_DIR = mkdtempSync(join(tmpdir(), "cosm-notebook-"));
  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env.COSM_NOTEBOOK_DIR;
    } else {
      process.env.COSM_NOTEBOOK_DIR = previous;
    }
  }
};

const extractPageId = (body: string) => {
  const match = body.match(/name="id" value="([^"]+)"/);
  expect(match).toBeTruthy();
  return match![1];
};

test("persistent notebook pages can be created, saved, run, and reloaded through request specs", () => {
  withNotebookDir(() => {
    const notebook = dispatchService(appSource, "GET", "/notebook");
    expect(ValueAdapter.cosmToJS(notebook.nativeProperty?.("status"))).toBe(200);
    const notebookBody = ValueAdapter.cosmToJS(notebook.nativeProperty?.("body"));
    expect(notebookBody).toContain("Saved Cosm block pages");
    expect(notebookBody).toContain("Attached Assistant");
    expect(notebookBody).toContain("Run Whole Page");

    const created = dispatchService(appSource, "POST", "/notebook/create", { body: "title=Runbook" });
    const createdBody = ValueAdapter.cosmToJS(created.nativeProperty?.("body"));
    expect(createdBody).toContain("Runbook");
    const pageId = extractPageId(String(createdBody));

    const blocks = JSON.stringify([
      { kind: "markdown", content: "# Notes\n\nPersisted page" },
      { kind: "cosm", content: "let answer = 41" },
      { kind: "cosm", content: "answer + 1" },
    ]);

    const run = dispatchService(appSource, "POST", "/notebook/run", {
      body: new URLSearchParams({ id: pageId, title: "Runbook", blocks }).toString(),
    });
    const runBody = ValueAdapter.cosmToJS(run.nativeProperty?.("body"));
    expect(runBody).toContain("Persisted page");
    expect(runBody).toContain("42");
    expect(runBody).toContain("notebook-page:");

    const reloaded = dispatchService(appSource, "GET", "/notebook", { query: { id: pageId } });
    const reloadedBody = ValueAdapter.cosmToJS(reloaded.nativeProperty?.("body"));
    expect(reloadedBody).toContain("Runbook");
    expect(reloadedBody).toContain("ok: 42");

    const reset = dispatchService(appSource, "POST", "/notebook/reset", {
      body: new URLSearchParams({ id: pageId, title: "Runbook", blocks }).toString(),
    });
    const resetBody = ValueAdapter.cosmToJS(reset.nativeProperty?.("body"));
    expect(resetBody).toContain("No execution has run yet.");
  });
}, 15000);

test("notebook attached assistant persists transcript across requests", () => {
  withNotebookDir(() => {
    CosmAiValue.installRuntimeHooks({
      cast: (_prompt, schema) => schema.validateAndReturn(Adapter.jsToCosm({
        should_reply: true,
        text: "I can see this notebook page and its recent execution summary.",
        rationale: "mocked notebook assistant reply",
        tool_calls: false,
        tool_results: false,
      })),
    });

    const created = dispatchService(appSource, "POST", "/notebook/create", { body: "title=Agent%20Page" });
    const createdBody = ValueAdapter.cosmToJS(created.nativeProperty?.("body"));
    const pageId = extractPageId(String(createdBody));
    const blocks = JSON.stringify([{ kind: "cosm", content: "1 + 1" }]);

    const turn = dispatchService(appSource, "POST", "/notebook/agent", {
      body: new URLSearchParams({
        id: pageId,
        title: "Agent Page",
        blocks,
        message: "What do you know about this page?",
      }).toString(),
    });
    const turnBody = ValueAdapter.cosmToJS(turn.nativeProperty?.("body"));
    expect(turnBody).toContain("I can see this notebook page and its recent execution summary.");

    const reloaded = dispatchService(appSource, "GET", "/notebook", { query: { id: pageId } });
    const reloadedBody = ValueAdapter.cosmToJS(reloaded.nativeProperty?.("body"));
    expect(reloadedBody).toContain("assistant: I can see this notebook page and its recent execution summary.");
  });
}, 15000);

test("web-layer request specs render notebook execution errors without leaking TypeScript paths", () => {
  withNotebookDir(() => {
    const blocks = JSON.stringify([{ kind: "cosm", content: "Prompt.complete" }]);
    const notebook = dispatchService(appSource, "POST", "/notebook/run", {
      body: new URLSearchParams({ title: "Broken", blocks }).toString(),
    });
    const body = ValueAdapter.cosmToJS(notebook.nativeProperty?.("body"));
    expect(body).toContain("Property error");
    expect(body).toContain("class Prompt has no property");
    expect(body).not.toContain("src/runtime/");
    expect(body).not.toContain("src/cosm.ts");
  });
});

test("assistant page can still reuse the shared controller core through the app wedge", () => {
  CosmAiValue.installRuntimeHooks({
    cast: (_prompt, schema) => schema.validateAndReturn(Adapter.jsToCosm({
      should_reply: true,
      text: "Use the Reset Session button in the notebook.",
      rationale: "mocked assistant page reply",
      tool_calls: false,
      tool_results: false,
    })),
  });

  const assistant = dispatchService(appSource, "GET", "/assistant");
  expect(ValueAdapter.cosmToJS(assistant.nativeProperty?.("status"))).toBe(200);
  const assistantBody = ValueAdapter.cosmToJS(assistant.nativeProperty?.("body"));
  expect(assistantBody).toContain("Page-backed support conversation");
  expect(assistantBody).toContain("AI Runtime");

  const turn = dispatchService(appSource, "POST", "/assistant", { body: "key=page-1&transcript=user%3A%20hello&message=How%20do%20I%20reset%20the%20notebook%20session%3F" });
  const turnBody = ValueAdapter.cosmToJS(turn.nativeProperty?.("body"));
  expect(turnBody).toContain("Use the Reset Session button in the notebook.");
  expect(turnBody).toContain("assistant: Use the Reset Session button in the notebook.");
});
