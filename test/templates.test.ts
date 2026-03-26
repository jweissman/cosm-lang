import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("yield is a narrow language feature for the current trailing block", () => {
  expect(cosmEval(`
    def wrap(value)
      yield(value + 1)
    end
    wrap(41) do |number|
      number
    end
  `)).toBe(42);
  expect(cosmEval(`
    def outer()
      let inner = ->() { yield("nested") }
      inner()
    end
    outer() do |label|
      label
    end
  `)).toBe("nested");
  expect(cosmEval(`
    def hasBlock()
      Kernel.blockGiven()
    end
    def withBlockProbe()
      hasBlock() do
        true
      end
    end
    let without = hasBlock()
    let withBlock = withBlockProbe()
    [without, withBlock]
  `)).toEqual([false, true]);
  expect(() => cosmEval("yield()")).toThrow("Block error: yield called without a current block");
});

test(".ecosm templates still interpolate explicit context bindings", () => {
  expect(cosmEval('require("app/views/notebook/result.ecosm"); result.render({ inspect: "42" })')).toContain("42");
  expect(cosmEval('require("app/views/layout/head.ecosm"); head.render({})')).toContain("tailwindcss");
});

test(".ecosm templates support preferred <%= ... %> interpolation while keeping #{...}", () => {
  expect(cosmEval('require("app/views/layout/page.ecosm"); page.render({ title: "Demo", extra_head: "<meta name=\\"x\\" content=\\"1\\">", extra_script: "<script>ok</script>" }, "<main>Body</main>")')).toContain("<title>Demo</title>");
  expect(cosmEval('require("app/notebook.cosm"); require("app/examples.cosm"); notebook.NotebookExamples.card(examples.receiver_reflection())')).toContain("Receiver reflection");
  expect(cosmEval('require("app/notebook.cosm"); notebook.NotebookExamples.markup()')).toContain("Method names first");
});

test(".ecosm layout templates can render child content through yield", () => {
  const rendered = cosmEval(`
    require("app/views/index.cosm")
    require("app/views/notebook/result.ecosm")
    views.html_view.render_layout("Demo", result, { inspect: "42" }, "", "")
  `);
  expect(rendered).toContain("<!doctype html>");
  expect(rendered).toContain("<title>Demo</title>");
  expect(rendered).toContain("42");
});

test(".ecosm layout yield no longer hijacks ordinary context keys", () => {
  expect(cosmEval(`
    require("app/views/layout/page.ecosm")
    page.render({ title: "Demo", extra_head: "", extra_script: "", body_label: "context-body" }, "<div>body</div>")
  `)).toContain("body");

  expect(cosmEval(`
    require("test/fixtures/template_context.ecosm")
    class TemplateContext
      def init(body_label, __yield__)
        true
      end
    end
    template_context.render(TemplateContext.new("context-body", "context-hidden"))
  `)).toContain("body=context-body hidden=context-hidden");
});

test("nested app/views loads keep basename and index bindings predictable", () => {
  expect(cosmEval('require("app/views/index.cosm"); views.class.name')).toBe("Module");
  expect(cosmEval('require("app/views/layout/head.ecosm"); head.class.name')).toBe("Module");
  expect(cosmEval('require("app/views/notebook/result.ecosm"); result.class.name')).toBe("Module");
});
