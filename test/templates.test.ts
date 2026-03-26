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
  expect(cosmEval('require "lib/app/views/notebook/result.ecosm"; App::Views::Notebook::Result.render({ inspect: "42" })')).toContain("42");
  expect(cosmEval('require "lib/app/views/layout/head.ecosm"; App::Views::Layout::Head.render({})')).toContain("tailwindcss");
});

test(".ecosm templates support preferred <%= ... %> interpolation while keeping #{...}", () => {
  expect(cosmEval('require "lib/app/views/layout/page.ecosm"; App::Views::Layout::Page.render({ title: "Demo", extra_head: "<meta name=\\"x\\" content=\\"1\\">", extra_script: "<script>ok</script>" }, "<main>Body</main>")')).toContain("<title>Demo</title>");
  expect(cosmEval('require "lib/app/notebook"; require "lib/app/examples"; App::Notebook::NotebookExamples.card(App::Examples.receiver_reflection())')).toContain("Receiver reflection");
  expect(cosmEval('require "lib/app/notebook"; App::Notebook::NotebookExamples.markup()')).toContain("Method names first");
});

test(".ecosm layout templates can render child content through yield", () => {
  const rendered = cosmEval(`
    require "lib/app/views/index"
    require "lib/app/views/notebook/result.ecosm"
    App::Rendering::HtmlView.render_layout("Demo", App::Views::Notebook::Result, { inspect: "42" }, "", "")
  `);
  expect(rendered).toContain("<!doctype html>");
  expect(rendered).toContain("<title>Demo</title>");
  expect(rendered).toContain("42");
});

test(".ecosm layout yield no longer hijacks ordinary context keys", () => {
  expect(cosmEval(`
    require "lib/app/views/layout/page.ecosm"
    App::Views::Layout::Page.render({ title: "Demo", extra_head: "", extra_script: "", body_label: "context-body" }, "<div>body</div>")
  `)).toContain("body");

  expect(cosmEval(`
    require "test/fixtures/template_context.ecosm"
    class TemplateContext
      def init(body_label, __yield__)
        true
      end
    end
    Test::Fixtures::TemplateContext.render(TemplateContext.new("context-body", "context-hidden"))
  `)).toContain("body=context-body hidden=context-hidden");
});

test("nested app/views loads expose explicit constant modules", () => {
  expect(cosmEval('require "lib/app/views/index"; App::Views.class.name')).toBe("Module");
  expect(cosmEval('require "lib/app/views/layout/head.ecosm"; App::Views::Layout::Head.class.name')).toBe("Module");
  expect(cosmEval('require "lib/app/views/notebook/result.ecosm"; App::Views::Notebook::Result.class.name')).toBe("Module");
});
