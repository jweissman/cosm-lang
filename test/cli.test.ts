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
  expect(result.stdout).toContain("Array");
});

test("cli can write output through Kernel.puts", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "puts.cosm");
  writeFileSync(sourcePath, 'Kernel.puts("hello from cosm"); 7\n');

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("hello from cosm");
  expect(result.stdout).toContain("7");
});

test("cli can write warnings through Kernel.warn", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "warn.cosm");
  writeFileSync(sourcePath, 'Kernel.warn("careful now"); 5\n');

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("5");
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
  expect(result.stdout).toContain("9");
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
  expect(stdout).toContain('"cosm"');
});

test("cli trace flags print parser and runtime traces", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "trace-flags.cosm");
  writeFileSync(sourcePath, "1 + 2\n");

  const surface = runCli([sourcePath, "--trace-surface"]);
  expect(surface.exitCode).toBe(0);
  expect(surface.stdout).toContain("[trace-surface]");
  expect(surface.stdout).toContain('"kind": "program"');

  const core = runCli([sourcePath, "--trace-core"]);
  expect(core.exitCode).toBe(0);
  expect(core.stdout).toContain("[trace-core]");
  expect(core.stdout).toContain('"kind": "add"');

  const send = runCli([sourcePath, "--trace-send"]);
  expect(send.exitCode).toBe(0);
  expect(send.stdout).toContain("[trace-send]");
  expect(send.stdout).toContain(".plus(2)");
});

test("cli supports bare puts with single-quoted strings", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "bare-puts.cosm");
  writeFileSync(sourcePath, "puts 'hello from bare puts'; 9\n");

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("hello from bare puts");
  expect(result.stdout).toContain("9");
});

test("cli can sketch a tiny Cosm-native test harness", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "kernel-test.cosm");
  writeFileSync(sourcePath, 'test("smoke", ->() { assert(true) }); test("sad", ->() { assert(false, "boom") }); 11\n');

  const result = runCli([sourcePath]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("ok - smoke");
  expect(result.stdout).toContain("not ok - sad: Assertion failed: boom");
  expect(result.stdout).toContain("11");
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
  expect(result.stdout).toContain("not ok - sad path: Assertion failed: boom");
  expect(result.stdout).toContain("test harness complete");
});

test("cli test mode reports failures and exits nonzero", () => {
  const result = runCli(["--test", "test/test.cosm"]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("# kernel basics");
  expect(result.stdout).toContain("# callables");
  expect(result.stdout).toContain("# objects");
  expect(result.stdout).toContain("ok - math smoke");
  expect(result.stdout).toContain("not ok - sad path: Assertion failed: boom");
  expect(result.stdout).toContain("7 passed, 1 failed, 8 total");
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
  expect(result.stdout).toContain("Cosm version:");
  expect(result.stderr).toContain("Error: --watch expects a file path");
  expect(result.stderr).toContain("Usage:");
});

test("cli rejects unknown switches loudly", () => {
  const result = runCli(["--watcch", "app/server.cosm"]);
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain("Cosm version:");
  expect(result.stderr).toContain("Error: unknown option '--watcch'");
  expect(result.stderr).toContain("Usage:");
});

test("cli rejects invalid mode combinations", () => {
  const result = runCli(["--watch", "--test", "test/test.cosm"]);
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain("Cosm version:");
  expect(result.stderr).toContain("Error: --watch and --test cannot be combined");
  expect(result.stderr).toContain("Usage:");
});

test("cli help prints usage", () => {
  const result = runCli(["--help"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Cosm version:");
  expect(result.stdout).toContain("Usage:");
  expect(result.stdout).toContain("cosm --watch <file.cosm>");
});

test("cli help command prints usage", () => {
  const result = runCli(["help"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Usage:");
});

test("cli can run the cosm self-test file", () => {
  const result = runCli(["test/core.cosm"]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toContain("core warning");
  expect(result.stdout).toContain("String");
});
