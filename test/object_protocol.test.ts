import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("Kernel.inspect delegates to representative runtime values cleanly", () => {
  expect(cosmEval("Kernel.inspect(Kernel)")).toBe("#<Kernel>");
  expect(cosmEval('Kernel.inspect(HttpResponse.text("ok", 201))')).toBe('#<HttpResponse 201 "ok">');
  expect(cosmEval("Kernel.inspect(HttpRouter.new())")).toBe("#<HttpRouter routes: 0>");
});

test("Kernel.inspect respects user-defined inspect methods", () => {
  expect(cosmEval(`
    class Painter
      def inspect()
        "<Painter custom>"
      end
    end
    Kernel.inspect(Painter.new())
  `)).toBe("<Painter custom>");
});

test("receiver-side inspect stays available on representative objects", () => {
  expect(cosmEval('Symbol.intern("ok").inspect()')).toBe(":ok");
  expect(cosmEval('Error.new("boom").inspect()')).toBe('#<Error "boom">');
  expect(cosmEval('Schema.string().inspect()')).toBe("Schema.string()");
});

test("Mirror inspect remains wrapper-visible", () => {
  expect(cosmEval("Kernel.inspect(Mirror.reflect([1, 2]))")).toBe("#<Mirror [1, 2]>");
  expect(cosmEval('Mirror.reflect(HttpRouter.new()).inspect()')).toBe('#<Mirror #<HttpRouter routes: 0>>');
});

test("print and puts use receiver-side to_s for non-strings", () => {
  let stdout = "";
  const originalWrite = process.stdout.write;
  (process.stdout as unknown as { write: typeof process.stdout.write }).write = ((chunk: string | Uint8Array) => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write;

  try {
    cosmEval(`
      class Printable
        def to_s()
          "custom-output"
        end
      end
      Kernel.print(Printable.new())
      Kernel.puts(Printable.new())
    `);
  } finally {
    (process.stdout as unknown as { write: typeof process.stdout.write }).write = originalWrite;
  }

  expect(stdout).toContain("custom-output");
  expect(stdout).toContain("custom-output\n");
});
