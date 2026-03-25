import { expect, test } from "bun:test";
import Cosm from "../../src/cosm";
import { ValueAdapter } from "../../src/ValueAdapter";
import { dispatchService } from "../support/request_spec";

test("http request and response runtime objects reflect cleanly", () => {
  const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

  expect(cosmEval('HttpResponse.ok("ok").class.name')).toBe("HttpResponse");
  expect(cosmEval('HttpResponse.ok("ok").status')).toBe(200);
  expect(cosmEval('HttpResponse.html("<h1>ok</h1>", 203).status')).toBe(203);
  expect(cosmEval('HttpResponse.html("<h1>ok</h1>", 203).headers.get("content-type")')).toBe("text/html; charset=utf-8");
  expect(cosmEval('HttpResponse.text("made", 201).status')).toBe(201);
  expect(cosmEval('HttpResponse.text("made", 201).body')).toBe("made");
  expect(cosmEval('HttpResponse.json({ answer: 42 }, 202).status')).toBe(202);
  expect(cosmEval('HttpResponse.json({ answer: 42 }, 202).headers.get("content-type")')).toBe("application/json");
  expect(cosmEval('let router = HttpRouter.new(); router.get("/", ->(req) { HttpResponse.text("hi", 200) }); router.length')).toBe(1);
});

test("router request specs can dispatch without a live server listen", () => {
  const response = dispatchService(`
    let router = HttpRouter.new()
    router.use do |req, next|
      next()
    end
    router.draw do
      get "/" do |req|
        HttpResponse.text("hi " + req.path, 200)
      end
      post "/submit" do |req|
        HttpResponse.text(req.bodyText(), 201)
      end
    end
    class RouterService
      def init(router)
        true
      end
      def handle(req)
        @router.handle(req)
      end
    end
    RouterService.new(router)
  `, "GET", "/");

  expect(ValueAdapter.cosmToJS(response.nativeProperty?.("status"))).toBe(200);
  expect(ValueAdapter.cosmToJS(response.nativeProperty?.("body"))).toBe("hi /");

  const postResponse = dispatchService(`
    let router = HttpRouter.new()
    router.draw do
      post "/submit" do |req|
        HttpResponse.text(req.bodyText(), 201)
      end
    end
    class RouterService
      def init(router)
        true
      end
      def handle(req)
        @router.handle(req)
      end
    end
    RouterService.new(router)
  `, "POST", "/submit", { body: "code=1%20%2B%202" });

  expect(ValueAdapter.cosmToJS(postResponse.nativeProperty?.("status"))).toBe(201);
  expect(ValueAdapter.cosmToJS(postResponse.nativeProperty?.("body"))).toBe("code=1%20%2B%202");
});
