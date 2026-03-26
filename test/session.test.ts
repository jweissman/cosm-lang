import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("Session.default exposes a stable explicit runtime session", () => {
  expect(cosmEval("Session.default().class.name")).toBe("Session");
  expect(cosmEval("Session.default().name")).toBe("default");
  expect(cosmEval("Session.default().inspect()")).toContain('#<Session "default"');
});

test("Session eval, tryEval, reset, and history work directly", () => {
  expect(cosmEval(`
    let session = Session.new()
    session.eval("let answer = 41")
    session.tryEval("answer + 1").inspect
  `)).toBe("42");

  expect(cosmEval(`
    let session = Session.new()
    session.eval("let first = 1")
    session.tryEval("first + 1")
    session.history().length
  `)).toBe(2);

  expect(cosmEval(`
    let session = Session.new()
    session.eval("let first = 1")
    session.reset()
    session.history().length
  `)).toBe(0);

  expect(cosmEval(`
    let session = Session.new()
    session.tryEval("let repeated = 1")
    session.tryEval("let repeated = 2")
    session.tryEval("repeated").inspect
  `)).toBe("2");
});

test("Kernel session helpers delegate to Session.default", () => {
  expect(cosmEval("Kernel.session().name")).toBe("default");
  expect(cosmEval('Kernel.eval("let delegated = 9"); Session.default().tryEval("delegated + 1").inspect')).toBe("10");
  expect(cosmEval("Kernel.resetSession()")).toBe(true);
  expect(cosmEval('Session.default().tryEval("delegated").ok')).toBe(false);
});

test("worker-backed sessions timeout cleanly and recover on the next eval", () => {
  const previousTimeout = process.env.COSM_SESSION_TIMEOUT_MS;
  process.env.COSM_SESSION_TIMEOUT_MS = "10";

  try {
    expect(cosmEval(`
      let session = Session.new()
      session.tryEval("Kernel.sleep(50); 1").error.message
    `)).toContain("Session timeout");

    process.env.COSM_SESSION_TIMEOUT_MS = "500";

    expect(cosmEval(`
      let session = Session.new()
      session.tryEval("Kernel.sleep(50); 1")
      session.tryEval("1 + 1").inspect
    `)).toBe("2");
  } finally {
    if (previousTimeout === undefined) {
      delete process.env.COSM_SESSION_TIMEOUT_MS;
    } else {
      process.env.COSM_SESSION_TIMEOUT_MS = previousTimeout;
    }
  }
});
