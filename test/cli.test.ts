import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.COSM_AI_AUTO_DISCOVER_MODEL ??= "0";

function decode(output: Uint8Array | undefined): string {
  return new TextDecoder().decode(output ?? new Uint8Array());
}

function runCli(args: string[]) {
  const proc = Bun.spawnSync(["bun", "bin/cosm", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      COSM_AI_AUTO_DISCOVER_MODEL: process.env.COSM_AI_AUTO_DISCOVER_MODEL ?? "0",
    },
  });

  return {
    exitCode: proc.exitCode,
    stdout: decode(proc.stdout),
    stderr: decode(proc.stderr),
  };
}

async function collectStream(stream: ReadableStream<Uint8Array> | null, sink: { value: string }) {
  if (!stream) {
    return;
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    sink.value += decoder.decode(value, { stream: true });
  }
}

async function waitForOutput(
  sink: { value: string },
  pattern: string,
  timeoutMs = 4000,
): Promise<void> {
  const startedAt = Date.now();
  while (!sink.value.includes(pattern)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for output: ${pattern}\nCurrent output:\n${sink.value}`);
    }
    await Bun.sleep(25);
  }
}

test("cli can evaluate a source file", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "smoke.cosm");
  writeFileSync(sourcePath, "assert([1, 2, 3].length == 3); assert(\"cosm\".length == 4); assert({ a: 1, b: 2 }.length == 2); classes.Array.name\n");

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("");
});

test("cli passes trailing args through to Process.argv for script entry files", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-argv-"));
  const sourcePath = join(tempDir, "argv.cosm");
  writeFileSync(sourcePath, 'Kernel.puts(Process.argv().join("|"))\n');

  const result = runCli([sourcePath, "alpha", "beta"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain(`${sourcePath}|alpha|beta`);
});

test("cli prints Cosm backtraces for raised runtime errors", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-backtrace-"));
  const sourcePath = join(tempDir, "boom.cosm");
  writeFileSync(sourcePath, 'class Demo\n  def boom()\n    missing_call()\n  end\nend\nDemo.new().boom()\n');

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("object of class Demo has no property 'missing_call'");
  expect(result.stderr).toContain("Backtrace");
  expect(result.stderr).toContain("invoke Demo.boom");
});

test("cli can run the local chat entrypoint with an explicit conversation name", () => {
  const proc = Bun.spawnSync(["bun", "bin/cosm", "lib/agent/chat_cli.cosm", "demo-chat"], {
    cwd: process.cwd(),
    stdin: new TextEncoder().encode("\n"),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      COSM_AI_AUTO_DISCOVER_MODEL: process.env.COSM_AI_AUTO_DISCOVER_MODEL ?? "0",
    },
  });

  const stdout = decode(proc.stdout);
  const stderr = decode(proc.stderr);
  expect(proc.exitCode).toBe(0);
  expect(stderr).toBe("");
  expect(stdout).toContain("demo-chat");
});

test("cli can write output through Kernel.puts", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "puts.cosm");
  writeFileSync(sourcePath, 'Kernel.puts("hello from cosm"); 7\n');

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("hello from cosm");
});

test("cli can write warnings through Kernel.warn", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "warn.cosm");
  writeFileSync(sourcePath, 'Kernel.warn("careful now"); 5\n');

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("careful now");
});

test("cli can trace inspected values through Kernel.trace", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "trace.cosm");
  writeFileSync(sourcePath, 'Kernel.trace("pair", { answer: 42 }); 9\n');

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("pair: { answer: 42 }");
});

test("cli can read a line through Kernel.readline", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "readline.cosm");
  writeFileSync(sourcePath, 'Kernel.readline("name? ")\n');

  const proc = Bun.spawnSync(["bun", "bin/cosm", sourcePath], {
    cwd: process.cwd(),
    stdin: new TextEncoder().encode("cosm\n"),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      COSM_AI_AUTO_DISCOVER_MODEL: process.env.COSM_AI_AUTO_DISCOVER_MODEL ?? "0",
    },
  });

  const stdout = decode(proc.stdout);
  const stderr = decode(proc.stderr);
  expect(proc.exitCode).toBe(0);
  expect(stderr).toBe("");
  expect(stdout).toContain("name? ");
});

test("cli trace flags print parser and runtime traces", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "trace-flags.cosm");
  writeFileSync(sourcePath, "1 + 2\n");

  const surface = runCli([sourcePath, "--trace-surface"]);
  expect(surface.exitCode).toBe(0);
  expect(surface.stdout).toContain("[trace-surface]");
  expect(surface.stdout).toContain("# top-level forms: 1");
  expect(surface.stdout).toContain('"kind": "program"');
  expect(surface.stdout).toContain('"kind": "add"');

  const core = runCli([sourcePath, "--trace-core"]);
  expect(core.exitCode).toBe(0);
  expect(core.stdout).toContain("[trace-core]");
  expect(core.stdout).toContain("# normalized statements: 1");
  expect(core.stdout).toContain('"kind": "program"');
  expect(core.stdout).toContain('"kind": "add"');

  const ir = runCli([sourcePath, "--trace-ir"]);
  expect(ir.exitCode).toBe(0);
  expect(ir.stdout).toContain("[trace-ir]");
  expect(ir.stdout).toContain('"op": "send"');

  const send = runCli([sourcePath, "--trace-send"]);
  expect(send.exitCode).toBe(0);
  expect(send.stdout).toContain("[trace-send]");
  expect(send.stdout).toContain(".plus(2)");
});

test("cli can execute a narrow program through vm mode", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "vm.cosm");
  writeFileSync(sourcePath, "let base = 1; Kernel.dispatch(base, :plus, 2)\n");

  const result = runCli([sourcePath, "--vm"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("");
});

test("cli can execute the dedicated vm smoke file", () => {
  const result = runCli(["test/vm.cosm", "--vm"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("");
});

test("cli can execute the assistant-shaped vm smoke file", () => {
  const result = runCli(["test/vm_assistant.cosm", "--vm"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("");
});

test("cli supports bare puts with single-quoted strings", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "bare-puts.cosm");
  writeFileSync(sourcePath, "puts 'hello from bare puts'; 9\n");

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("hello from bare puts");
});

test("cli can sketch a tiny Cosm-native test harness", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "kernel-test.cosm");
  writeFileSync(sourcePath, 'require "cosm/spec.cosm"; suite("smoke", ->() { it("passes", ->() { assert(true) }) })\n');

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("# smoke");
  expect(result.stdout).toContain("ok - passes");
});

test("cli test mode injects implicit spec helpers", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-test-mode-"));
  const sourcePath = join(tempDir, "implicit_spec.cosm");
  writeFileSync(sourcePath, 'suite("smoke", ->() { it("passes", ->() { assert_equal(2 + 2, 4) }) })\n');

  const result = runCli(["test", sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("# smoke");
  expect(result.stdout).toContain("ok - passes");
  expect(result.stdout).toContain("1 passed, 0 failed, 1 total");
});

test("ordinary runs do not inject implicit spec helpers", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-no-spec-globals-"));
  const sourcePath = join(tempDir, "ordinary.cosm");
  writeFileSync(sourcePath, 'suite("smoke", ->() { true })\n');

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("unknown identifier 'suite'");
});

test("cli can run the dedicated Cosm test file", () => {
  const result = runCli(["test/test.cosm"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("# kernel basics");
  expect(result.stdout).toContain("# callables");
  expect(result.stdout).toContain("# objects");
  expect(result.stdout).toContain("ok - math smoke");
  expect(result.stdout).toContain("ok - class smoke");
  expect(result.stdout).toContain("ok - sad path");
});

test("cli test mode reports failures and exits nonzero", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-failing-test-"));
  const sourcePath = join(tempDir, "failing_spec.cosm");
  writeFileSync(sourcePath, 'suite("smoke", ->() { it("passes", ->() { assert(true) }); it("fails", ->() { assert(false, "boom") }) })\n');

  const result = runCli(["--test", sourcePath]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("# smoke");
  expect(result.stdout).toContain("ok - passes");
  expect(result.stdout).toContain("not ok - fails: Assertion failed: boom");
  expect(result.stdout).toContain("1 passed, 1 failed, 2 total");
});

test("cli watch mode restarts a target file on change", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-watch-"));
  const sourcePath = join(tempDir, "watch.cosm");
  writeFileSync(sourcePath, 'Kernel.puts("watch-start"); 1\n');

  const proc = Bun.spawn(["bun", "bin/cosm", "--watch", sourcePath], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      COSM_AI_AUTO_DISCOVER_MODEL: process.env.COSM_AI_AUTO_DISCOVER_MODEL ?? "0",
    },
  });

  const stdoutSink = { value: "" };
  const stderrSink = { value: "" };
  const stdoutTask = collectStream(proc.stdout, stdoutSink);
  const stderrTask = collectStream(proc.stderr, stderrSink);

  await waitForOutput(stdoutSink, `[watch] watching ${sourcePath}`);
  await waitForOutput(stdoutSink, "watch-start");

  writeFileSync(sourcePath, 'Kernel.puts("watch-restart"); 2\n');

  await waitForOutput(stdoutSink, `[watch] restarting ${sourcePath}`);
  await waitForOutput(stdoutSink, "watch-restart");

  proc.kill("SIGTERM");
  const exitCode = await proc.exited;
  await Promise.all([stdoutTask, stderrTask]);

  expect(exitCode).toBe(0);
  expect(stderrSink.value).toBe("");
  expect(stdoutSink.value).toContain("watch-start");
  expect(stdoutSink.value).toContain("watch-restart");
});

test("cli watch mode also works with trailing --watch", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-watch-trailing-"));
  const sourcePath = join(tempDir, "watch-tail.cosm");
  writeFileSync(sourcePath, 'Kernel.puts("tail-watch"); 3\n');

  const proc = Bun.spawn(["bun", "bin/cosm", sourcePath, "--watch"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      COSM_AI_AUTO_DISCOVER_MODEL: process.env.COSM_AI_AUTO_DISCOVER_MODEL ?? "0",
    },
  });

  const stdoutSink = { value: "" };
  const stderrSink = { value: "" };
  const stdoutTask = collectStream(proc.stdout, stdoutSink);
  const stderrTask = collectStream(proc.stderr, stderrSink);

  await waitForOutput(stdoutSink, `[watch] watching ${sourcePath}`);
  await waitForOutput(stdoutSink, "tail-watch");

  proc.kill("SIGTERM");
  const exitCode = await proc.exited;
  await Promise.all([stdoutTask, stderrTask]);

  expect(exitCode).toBe(0);
  expect(stderrSink.value).toBe("");
  expect(stdoutSink.value).toContain("tail-watch");
});

test("cli watch mode rejects a missing file path", () => {
  const result = runCli(["--watch"]);
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Error: --watch expects a file path");
  expect(result.stderr).toContain("Usage:");
});

test("cli rejects unknown switches loudly", () => {
  const result = runCli(["--watcch", "lib/app/server.cosm"]);
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Error: unknown option '--watcch'");
  expect(result.stderr).toContain("Usage:");
});

test("cli rejects invalid mode combinations", () => {
  const result = runCli(["--watch", "--test", "test/test.cosm"]);
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Error: --watch and --test cannot be combined");
  expect(result.stderr).toContain("Usage:");
});

test("cli help prints usage", () => {
  const result = runCli(["--help"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Usage:");
  expect(result.stdout).toContain("cosm test [file.cosm|spec/|test/]");
  expect(result.stdout).toContain("cosm --watch <file.cosm>");
});

test("cli prints a bare version with --version", () => {
  const result = runCli(["--version"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout.trim()).toMatch(/^0\.3\./);
  expect(result.stdout).not.toContain("Cosm version:");
});

test("cli help command prints usage", () => {
  const result = runCli(["help"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Usage:");
});

test("cli can evaluate one-off source with -e", () => {
  const result = runCli(["-e", "let value = [1, 2, 3, 4]; value.reduce(0, ->(acc, entry) { acc + entry })"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("");
});

test("cli can run the cosm self-test file", () => {
  const result = runCli(["spec/core.cosm"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("# Core language expressions");
  expect(result.stdout).toContain("# Reflection");
});

test("cli can run the dedicated runtime harness spec bundle", () => {
  const result = runCli(["test", "spec/runtime/baseline.cosm"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("# Kernel");
  expect(result.stdout).toContain("# Support chatbot helpers");
  expect(result.stdout).toContain("passed");
});

test("cli test with no target runs the maintained Cosm spec bundles", () => {
  const result = runCli(["test"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("==> spec/core.cosm");
  expect(result.stdout).toContain("==> spec/runtime/baseline.cosm");
  expect(result.stdout).toContain("test bundles passed");
});

test("cli test accepts the narrow spec/ directory shorthand", () => {
  const result = runCli(["test", "spec/"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("==> spec/core.cosm");
  expect(result.stdout).toContain("==> spec/runtime/baseline.cosm");
});

test("cli test accepts the narrow test/ directory shorthand", () => {
  const result = runCli(["test", "test/"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("# kernel basics");
  expect(result.stdout).toContain("passed");
});

test("cli can execute the support-oriented vm smoke file", () => {
  const result = runCli(["test/vm_support.cosm", "--vm"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("");
});
