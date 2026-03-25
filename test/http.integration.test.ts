import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const httpTest = process.env.COSM_HTTP_INTEGRATION === "1" ? test : test.skip;

const startHttpServer = (
  handlerSource: (port: number) => string,
) => {
  const candidates = [32145, 32146, 32147, 32148, 32149, 32150];
  for (const port of candidates) {
    const env = Cosm.Interpreter.createEnv();
    try {
      Cosm.Interpreter.evalInEnv(handlerSource(port), env);
      return { env, port };
    } catch (error) {
      if (
        error instanceof Error
        && (error.message.includes("EADDRINUSE") || error.message.includes("in use"))
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("failed to start test http server on candidate ports");
};

httpTest("http runtime can serve a tiny Bun-native handler", async () => {
  const { env } = startHttpServer((port) => `let server = http.serve(${port}, ->(req) { HttpResponse.text("hello " + req.path, 200) })`);
  const url = ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("server.url", env));

  try {
    const response = await fetch(`${url}/ping`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("hello /ping");
    expect(ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("server.class.name", env))).toBe("HttpServer");
    expect(ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("server.port > 0", env))).toBe(true);
  } finally {
    Cosm.Interpreter.evalInEnv("server.stop()", env);
  }
});

httpTest("http runtime can serve a bound method handler", async () => {
  const { env } = startHttpServer((port) => `
    class App
      def handle(req)
        HttpResponse.text("method " + req.path, 200)
      end
    end
    let app = App.new()
    let server = http.serve(${port}, app.method(:handle))
  `);
  const url = ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("server.url", env));

  try {
    const response = await fetch(`${url}/bound`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("method /bound");
  } finally {
    Cosm.Interpreter.evalInEnv("server.stop()", env);
  }
});

httpTest("http runtime can serve a service object directly through handle(req)", async () => {
  const { env } = startHttpServer((port) => `
    class App
      def handle(req)
        HttpResponse.text("object " + req.path, 200)
      end
    end
    let server = http.serve(${port}, App.new())
  `);
  const url = ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("server.url", env));

  try {
    const response = await fetch(`${url}/object`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("object /object");
  } finally {
    Cosm.Interpreter.evalInEnv("server.stop()", env);
  }
});

httpTest("http handlers can reflect request properties and build json responses", async () => {
  const { env } = startHttpServer((port) => `let server = http.serve(${port}, ->(req) {
    HttpResponse.json({
      method: req.method,
      path: req.path,
      query: req.query.get("kind"),
      body: req.bodyText(),
      header: req.headers.get("x-test")
    }, 201)
  })`);
  const url = ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("server.url", env));

  try {
    const response = await fetch(`${url}/items?kind=query`, {
      method: "POST",
      headers: {
        "x-test": "works",
      },
      body: "payload",
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({
      method: "POST",
      path: "/items",
      query: "query",
      body: "payload",
      header: "works",
    });
  } finally {
    Cosm.Interpreter.evalInEnv("server.stop()", env);
  }
});

httpTest("http router can serve exact routes and html responses", async () => {
  const { env } = startHttpServer((port) => `
    let router = HttpRouter.new()
    router.use do |req, next|
      next()
    end
    router.draw do
      get "/" do |req|
        HttpResponse.html("""<h1>Hello #{req.path}</h1>""", 200)
      end
    end
    let server = http.serve(${port}, router)
  `);
  const url = ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("server.url", env));

  try {
    const ok = await fetch(`${url}/`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await ok.text()).toBe("<h1>Hello /</h1>");

    const missing = await fetch(`${url}/missing`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("No route for GET /missing");

    const methodMismatch = await fetch(`${url}/`, { method: "POST" });
    expect(methodMismatch.status).toBe(404);
    expect(await methodMismatch.text()).toContain("No route for POST /");
  } finally {
    Cosm.Interpreter.evalInEnv("server.stop()", env);
  }
});

httpTest("http runtime can serve a router-backed app object", async () => {
  const originalNotebookDir = process.env.COSM_NOTEBOOK_DIR;
  process.env.COSM_NOTEBOOK_DIR = mkdtempSync(join(tmpdir(), "cosm-http-notebook-"));
  const { env } = startHttpServer((port) => `
    require("app/app.cosm")
    let server = http.serve(${port}, app.App.build())
  `);
  const url = ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("server.url", env));

  try {
    const response = await fetch(`${url}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, path: "/health" });

    const notebook = await fetch(`${url}/notebook`);
    expect(notebook.status).toBe(200);
    expect(await notebook.text()).toContain("Saved Cosm block pages");

    const create = await fetch(`${url}/notebook/create`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ title: "HTTP integration page" }).toString(),
    });
    expect(create.status).toBe(200);
    const createdHtml = await create.text();
    expect(createdHtml).toContain("HTTP integration page");
    const idMatch = createdHtml.match(/name="id" value="([^"]+)"/);
    expect(idMatch?.[1]).toBeTruthy();
    const pageId = idMatch![1];

    const run = await fetch(`${url}/notebook/run`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        id: pageId,
        title: "HTTP integration page",
        blocks: JSON.stringify([
          { kind: "markdown", content: "# Notes" },
          { kind: "cosm", content: "let answer = 41" },
          { kind: "cosm", content: "answer + 1" },
        ]),
      }).toString(),
    });
    expect(run.status).toBe(200);
    const runHtml = await run.text();
    expect(runHtml).toContain("Whole-Page Output");
    expect(runHtml).toContain("42");
  } finally {
    Cosm.Interpreter.evalInEnv("server.stop()", env);
    process.env.COSM_NOTEBOOK_DIR = originalNotebookDir;
  }
}, 15000);
