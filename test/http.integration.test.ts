import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const httpTest = process.env.COSM_HTTP_INTEGRATION === "1" ? test : test.skip;

const startHttpServer = (
  env: ReturnType<typeof Cosm.Interpreter.createEnv>,
  handlerSource: (port: number) => string,
) => {
  const candidates = [32145, 32146, 32147, 32148, 32149, 32150];
  for (const port of candidates) {
    try {
      Cosm.Interpreter.evalInEnv(handlerSource(port), env);
      return port;
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
  const env = Cosm.Interpreter.createEnv();
  startHttpServer(env, (port) => `let server = http.serve(${port}, ->(req) { HttpResponse.text("hello " + req.path, 200) })`);
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
  const env = Cosm.Interpreter.createEnv();
  startHttpServer(env, (port) => `
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
  const env = Cosm.Interpreter.createEnv();
  startHttpServer(env, (port) => `
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
  const env = Cosm.Interpreter.createEnv();
  startHttpServer(env, (port) => `let server = http.serve(${port}, ->(req) {
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
  const env = Cosm.Interpreter.createEnv();
  startHttpServer(env, (port) => `
    let router = HttpRouter.new()
    router.draw(->() {
      get("/", ->(req) { HttpResponse.html("""<h1>Hello #{req.path}</h1>""", 200) })
    })
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
  const env = Cosm.Interpreter.createEnv();
  startHttpServer(env, (port) => `
    require("app/app.cosm")
    let server = http.serve(${port}, app.App.build())
  `);
  const url = ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("server.url", env));

  try {
    const response = await fetch(`${url}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, path: "/health" });
  } finally {
    Cosm.Interpreter.evalInEnv("server.stop()", env);
  }
});
