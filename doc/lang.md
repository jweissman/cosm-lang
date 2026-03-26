# Cosm Language Reference

## Current Surface

Cosm currently evaluates a small expression language with semicolon-separated programs, lexical blocks, `if` expressions, stabby lambdas, trailing `do ... end` call blocks, named `def` functions, and small reflective service/runtime objects.

Programs also support lexical local bindings with `let`.
There is also a small bootstrap `require("...")` statement form for loading ambient stdlib helpers into the current scope. It remains statement-shaped, but now evaluates to a real `Module` object.

Line comments starting with `#` are ignored anywhere whitespace is allowed.

### Literals

- Numbers: `1`, `2.5`
- Booleans: `true`, `false`
- Double-quoted strings: `"cosm"`, `"line\nbreak"`
- Triple-quoted strings: `"""<h1>Hello #{name}</h1>"""`
- Single-quoted strings: `'cosm'`, `'#{not interpolated}'`
- Symbol literals: `:status`
- Interned symbols: `Symbol.intern("status")`
- Interpolated strings: `"hello #{name}"`
- Arrays: `[1, 2, 3]`
- Hashes: `{ answer: 42, ok: true, title: "cosm" }`

### Operators

- Arithmetic: `+`, `-`, `*`, `/`, `^`
  `+` also concatenates strings, and strings can concatenate numbers and booleans.
- Unary: `+x`, `-x`, `!x`
- Comparison: `==`, `!=`, `<`, `<=`, `>`, `>=`
- Boolean: `&&`, `||`
- Member access: `value.name`
- Function call: `fn(arg1, arg2)`
- Trailing call block: `fn(args...) do ... end`
- Narrow block invocation: `yield()` / `yield(arg1, arg2)`

### Callables

- Lambdas: `->(arg1, arg2) { expr }`
- Named defs: `def name(arg1, arg2) do ... end`
- Named defs may also omit `do` when the body is already delimited by `end`: `def name(arg1) expr end`
- Calls may also take a trailing `do ... end` block, which still lowers to a final lambda argument under the hood.

In `0.3.12.x`, stabby lambdas remain the only standalone parameterized lambda form. Trailing call blocks may now bind parameters like `get "/" do |req| ... end`, and method/function bodies may call `yield(...)` to invoke the current implicit trailing block. `Kernel.blockGiven()` now exposes the presence of that current block, while block capture and forwarding are still intentionally deferred.

### Classes

- `class Name do ... end`
- `class Name < Superclass do ... end`
- `class Name ... end` is also accepted without the extra `do`

Class bodies currently support instance methods via `def name(...)` and explicit class methods via `def self.name(...)`. A method named `init` defines constructor arity and field names; its parameter list becomes the class's declared fields. Class definitions bind a class value, appear in `classes`, and expose collected slots and methods through `.slots`, `.methods`, and `.classMethods`.
Instances can be created with `ClassName.new(...)`, and constructor arguments are assigned positionally to the fields implied by `init`. Instance methods can refer to `self`, and `init` bodies run after those fields are assigned.
Inside instance methods, `@name` is shorthand for reading the instance field named `name`. This makes object-state provenance explicit without replacing `self.name`.
Class objects can receive methods too, but only when those methods are declared explicitly with `def self.name(...)`.
Ordinary classes now reflect through minimal per-class metaclasses, while `Class` remains the bootstrap anchor. That means `Point.class.name` and `Point.metaclass.name` are both `Point class`, `Point.metaclass.class.name` is `Class`, and `Class.class.name` stays `Class`.
At the moment, `.class` on a class object is intentionally the same reflective link as `.metaclass`. That is transparent, but still somewhat provisional; richer class-side authoring syntax may come later once the underlying model feels less surprising.
Class bodies also now support an explicit class-side block form:

```cosm
class Thing
  class << self
    def label()
      "Thing!"
    end
  end
end
```

Inside `class << self ... end`, `self` is the class object, and defs become class-side methods. In `0.3.12.x`, this is equivalent to existing `def self.name(...)` behavior rather than a second metaclass semantics.

### Control Flow

- Blocks: `do ... end`
- Conditional expressions: `if cond then ... else ... end`

### Programs

Programs may contain multiple expressions separated by `;`. The value of the last expression is the program result.
At statement position, simple convenience calls may also omit parentheses, so forms like `assert true` and `puts 'hello'` are accepted as sugar for ordinary calls.
`require("...")` is also statement-shaped in the current grammar, even though it returns a real module value when evaluated.

```cosm
router.draw do
  get("/", ->(req) { HttpResponse.text("hi", 200) })
end
```

That trailing block form is intentionally narrow in `0.3.12.x`: it is still just sugar for an extra final lambda argument. It now supports block parameters on trailing call blocks, but it does not yet support ampersand-style capture/forwarding.

```cosm
def around(value)
  yield(value + 1)
end

around(41) do |number|
  number
end
```

`yield(...)` is only valid when the current function or method was invoked with a trailing block. Calling `yield(...)` without a current block raises a structured block error.

```cosm
let label = "co" + "sm";
assert(1 + 1 == 2);
assert(label == "cosm");
assert((if true then 1 else 2 end) == 1);
assert([1, 2, 3].length == 3);
assert("cosm".length == 4);
assert({ left: 1, right: 2 }.length == 2);
42
```

### Bindings

- `let name = expr`

`let` introduces a local binding in the current lexical scope. Duplicate local names in the same scope are rejected, but inner blocks may shadow outer names.

```cosm
let answer = 40;
let label = "co" + "sm";
assert(label == "cosm");
answer + 2
```

### Modules

- `Module`
- `require("cosm/test")`

Cosm now has a small reflective `Module` runtime object. The first real example is `cosm.test`, which is also exposed through `cosm.modules.test`.

Module objects currently support:

- `.name`
- `.keys()`
- `.values()`
- `.has(symbolOrString)`
- `.get(symbolOrString)`

`require("cosm/test")` now works both as a statement and as an expression. The preferred style is explicit binding:

```cosm
let test_module = require("cosm/test")
```

For one compatibility patch line, `require(...)` still also injects basename bindings like `examples`, `chat`, or `slack_dm` into the current scope, and `require("cosm/test")` still injects bootstrap helpers like `test`, `describe`, and `expectEqual`.

Local `.cosm` files may also be loaded through `require("path/to/file.cosm")`. In `0.3.12.x`, `.ecosm` files may also be loaded through `require(...)` as renderable module objects with a `render(context)` or `render(context, body)` entry point, which fits naturally with an `app/views/...` layout. `.ecosm` now supports both compatibility `#{...}` interpolation and preferred `<%= ... %>` interpolation. Layout composition may provide template child content through `yield()` inside `.ecosm`, and in `0.3.12.x` that body now flows through renderer-owned metadata rather than hijacking ordinary context keys.

`require("app/examples.cosm")` is also now used as a small example of Cosm-authored app support code: a plain module that exposes notebook example source through ordinary defs. `require("support/chat.cosm")` and `require("support/agent.cosm")` now provide the tiny support-assistant core that both the CLI chatbot and the separate Slack agent service build on.

`Data` is now also available as a module-backed stdlib surface. It exposes:

- `Data.string()`
- `Data.number()`
- `Data.boolean()`
- `Data.enum(values...)`
- `Data.array(inner)`
- `Data.optional(inner)`
- `Data.object(fields)`
- `Data.model(name, fields)`

`Data.model(...)` returns a `DataModel` value with:

- `.name`
- `.fields`
- `.schema()`
- `.validate(value)`
- `.jsonSchema()`
- `.inspect()`

### Blocks and Conditionals

Both `do ... end` and `if ... then ... else ... end` are expressions. Each block creates a new lexical scope and evaluates to the last value produced inside it.

```cosm
let label = "outer";
do
  let label = "inner";
  assert(label == "inner");
  42
end;
label
```

```cosm
if true then
  "yes"
else
  "no"
end
```

Cosm also now supports a narrow ternary expression form:

```cosm
cosm.ai.config().configured ? "ready" : "missing"
```

### Functions

- `->() { expr }`
- `->(arg1, arg2) { expr }`
- `def name(arg1, arg2) do ... end`

Lambdas are stabby functions whose bodies may now contain a full statement list. `def` introduces named functions with `do ... end` bodies. Both capture outer lexical bindings, bind parameters in their call scope, and return the last value of their body.

Cosm also now has a small missing-method fallback for instance sends. If an object defines `does_not_understand(message, args)`, then missing sends on that object will call it with:

- `message` as a `Symbol`
- `args` as an `Array`

This is intentionally minimal for now and does not include variadics or block capture.

```cosm
let prefix = "co";
let join = ->(rest) { prefix + rest };
join("sm")
```

```cosm
class Builder
  def does_not_understand(message, args)
    message.name + ":" + args.length
  end
  def render()
    wrapper("ok")
  end
end

Builder.new().render()
```

```cosm
def greet(name) do
  "hello " + name
end;
greet("cosm")
```

```cosm
class Greeter do
  def self.label() do
    self.name + "!"
  end
end;

Greeter.classMethods.label.name
```

```cosm
class Pair do
  def init(left, right) do
    true
  end
  def sum() do
    @left + @right
  end
end;

let pair = Pair.new(1, 2);
pair.sum()
```

```cosm
class Greeter do
  def self.label() do
    self.name + "!"
  end
  def self.kind() do
    self.class.name
  end
end;

Greeter.label()
Greeter.kind()
```

```cosm
class Point do end;
Point.class.name
Point.metaclass.name
Point.metaclass.class.name
Class.class.name
```

```cosm
1.plus(2)
"co".plus("sm")
```

### Built-ins

- `assert(condition)`
- `assert(condition, message)`
  Raises `Assertion failed` unless `condition` evaluates to `true`. With a message, it raises `Assertion failed: <message>`.
- `Kernel.assert(condition)`
- `Kernel.assert(condition, message)`
  `Kernel` now exposes the same assertion service reflectively.
- `Kernel.puts(value)`
  Writes one formatted line to stdout. Strings print without quotes; other values use Cosm-style formatting.
- `Kernel.print(value)`
  Writes formatted output to stdout without a trailing newline.
- `Kernel.warn(value)`
  Writes one formatted line to stderr.
- `Time.now()`
  Returns the current host timestamp in milliseconds since the Unix epoch.
- `Time.isoNow()`
  Returns the current time as an ISO-8601 UTC string.
- `Time.iso(ms)`
  Returns the given numeric timestamp as an ISO-8601 UTC string.
- `Time.fromIso(string)`
  Parses an ISO-8601 string into a numeric timestamp in milliseconds.
- `Process.cwd()`
  Returns the current working directory as a string.
- `Process.argv()`
  Returns the current host argv as an array of strings.
- `Process.pid()`
  Returns the current host process id as a number.
- `Process.platform()`
  Returns the current host platform string.
- `Process.arch()`
  Returns the current host architecture string.
- `Process.env(name)`
  Returns the host environment variable string for `name`, or `false` if it is not present.
- `Process.exit(code?)`
  Exits the current host process. `code` defaults to `0` and must be an integer when provided.
- `Kernel.sleep(ms)`
  Sleeps synchronously for a non-negative millisecond duration.
- `Kernel.uuid()`
  Returns a host-backed UUID string for lightweight ids in notebook/app code.
- `Kernel.escapeHtml(string)`
  Escapes a string for safe inclusion in server-rendered HTML text contexts.
- `Kernel.eval(source)`
  Evaluates Cosm source in `Session.default()` and returns the resulting value.
- `Kernel.tryEval(source)`
  Evaluates Cosm source in that same default session, but returns a namespace with `.ok`, `.value`, `.inspect`, and `.error` instead of raising.
- `Kernel.tryValidate(value, schemaOrModel)`
  Attempts a `Schema` or `DataModel` validation and returns `{ ok, value, inspect, error }` instead of raising.
- `Kernel.blockGiven()`
  Returns whether the current function or method has an implicit trailing block available to `yield(...)`.
- `Session.default()`
  Returns the default worker-backed session used by `Kernel.eval(...)` and `Kernel.tryEval(...)`.
- `Session.new()`
  Creates a fresh explicit worker-backed session with its own bindings and history.
- `session.eval(source)`
  Evaluates Cosm source inside that session and returns the resulting value.
- `session.tryEval(source)`
  Evaluates Cosm source inside that session and returns `{ ok, value, inspect, error }`.
- `session.reset()`
  Clears bindings, history, last result, and last error for that session.
- `session.history()`
  Returns a small array of prior eval records for that session.
- `COSM_SESSION_TIMEOUT_MS`
  Optional host environment variable controlling the per-eval session timeout in milliseconds. Defaults to `1500`.
- `COSM_AI_MODEL`
  Optional host environment variable forcing a specific LM Studio model. When unset, `cosm.ai` attempts to discover one through `/v1/models`.

- `require("cosm/ai.cosm")`
  Loads a small Cosm-authored helper module that wraps `cosm.ai` with `status()`, `config()`, `health()`, `complete(prompt)`, `compare(left, right)`, `stream(prompt)`, and `cast(prompt, schemaOrModel)`.
- `Random.float()`
  Returns a host `Number` in the usual JS range `0 <= n < 1`.
- `Random.int(max)`
  Returns a host integer `0 <= n < max`.
- `Random.choice(array)`
  Returns one random element from a non-empty array.
- `Kernel.expectEqual(actual, expected, message?)`
  Tiny bootstrap equality helper for tests. Raises if the two values are not equal under Cosm equality.
- `Kernel.test(name, fn)`
  Runs a zero-argument function or method, prints a tiny pass/fail line, and returns `true` or `false`.
- `Kernel.describe(name, fn)`
  Prints a section header, runs a zero-argument function or method, and returns that callable's result.
- `Kernel.resetTests()`
  Clears the current test counters.
- `Kernel.testSummary()`
  Returns a hash with `passed`, `failed`, and `total`.
- `puts(value)`
  Convenience global alias for `Kernel.puts(value)`.
- `print(value)`
  Convenience global alias for `Kernel.print(value)`.
- `warn(value)`
  Convenience global alias for `Kernel.warn(value)`.
- `test(name, fn)`
  Convenience global alias for `Kernel.test(name, fn)`.
- `describe(name, fn)`
  Available after `require("cosm/test")`, and also exposed as `cosm.test.describe(...)`.
- `expectEqual(actual, expected, message?)`
  Available after `require("cosm/test")`, and also exposed as `cosm.test.expectEqual(...)`.
- `resetTests()`
  Convenience global alias for `Kernel.resetTests()`.
- `testSummary()`
  Convenience global alias for `Kernel.testSummary()`.
- `Kernel.inspect(value)`
  Returns the Cosm-oriented inspected string for a value.
- `http.serve(port, handler)`
  Starts a tiny Bun-native HTTP server. `handler` may be a first-class function, a bound method, or an object that implements `handle(req)`. The resolved handler receives an `HttpRequest` object and may return either a string-like body value, an `HttpResponse` object, or a transitional hash like `{ status: 201, body: "ok" }`.
- `HttpRouter.new()`
- `router.handle(method, path, handler)`
- `router.handle(req)`
- `router.get(path, handler)`
- `router.post(path, handler)`
- `router.put(path, handler)`
- `router.delete(path, handler)`
- `router.draw(->() { ... })`
- `router.draw do ... end`
- `router.use(middleware)`
  Tiny exact-path router helpers. In `0.3.12.x`, routes match on exact method + exact path only. Unmatched routes return a plain `404` response, invalid handler registration errors are raised immediately, and router-level middleware may wrap dispatch through `next()`.
- `HttpRequest.method`
- `HttpRequest.url`
- `HttpRequest.path`
- `HttpRequest.headers`
- `HttpRequest.query`
- `HttpRequest.bodyText()`
- `HttpRequest.form()`
- `HttpResponse.ok(body)`
- `HttpResponse.html(body, status?)`
- `HttpResponse.text(body, status?)`
- `HttpResponse.json(value, status?)`
- `HttpResponse.status`
- `HttpResponse.body`
- `HttpResponse.headers`
- `HttpServer.stop()`
  Stops a server started through `http.serve(...)`.
- `Kernel.dispatch(receiver, message, ...args)`
  Performs an explicit helper-form message send where `message` is a string or symbol.
- `Mirror.reflect(value)`
  Returns a readonly reflective wrapper around `value`.
- `mirror.targetClass`
- `mirror.inspect()`
- `mirror.methods()`
- `mirror.get(name)`
- `mirror.has(name)`
- `value.methods()`
  Returns an array of visible method symbols for a live receiver. For ordinary values this includes inherited methods and runtime-backed primitive methods visible to dispatch. On class objects, this reflects the receiver's own callable surface.
- `value.method(message)`
  Returns a bound `Method` object for a method on a receiver. On class objects, this reflects the receiver's own callable surface.
- `ClassValue.classMethod(message)`
  Returns a bound class-side `Method` object for a class object.
- `fn.call(arg1, arg2)`
  Invokes a first-class function explicitly through the object model.

### Built-in Repository

- `classes`
  Reflective object containing core classes.
- `Kernel`
  Reflective object for ambient services. `Kernel.class.name` is `Kernel`, and `classes.Kernel` is the reflective class object behind it.
- `Process`
  Reflective object for host process access like `cwd()`, `argv()`, and `env(name)`.
- `Time`
  Reflective object for host time access like `now()`.
- `Random`
  Reflective object for host randomness like `float()` and `int(max)`.
- `Module`
  Reflective class for loaded module objects like `cosm.test`.
- `Mirror`
  Reflective class for readonly mirror wrappers created through `Mirror.reflect(...)`.
- `http`
  First Bun-native host-service object. `http.class.name` is `Http`, and servers returned from `http.serve(...)` are `HttpServer` instances.
- `HttpRouter`
  Tiny exact-path router class for small service objects.
- `cosm`
  Reflective root object currently exposing `Kernel`, `Process`, `Time`, `Random`, `Mirror`, `HttpRouter`, `http`, `classes`, `modules`, `test`, and `version`.
  `cosm.length`, `cosm.keys()`, `cosm.values()`, `cosm.has(:name)`, and `cosm.get(:name)` now work through the `Namespace` runtime model.
- `Symbol`
  Built-in class for interned symbols via `:name` literals or `Symbol.intern("name")`.
- User-defined classes also appear in `classes` within the current evaluation/session scope.
- Core classes:
  `Class`, `Object`, `Number`, `Boolean`, `String`, `Array`, `Hash`, `Function`, `Mirror`, `Http`, `HttpRequest`, `HttpResponse`, `HttpServer`, `HttpRouter`

Examples:

```cosm
classes.Array.name
Kernel.assert(true)
Kernel.print("hello")
Kernel.puts("hello from cosm")
Kernel.warn("careful now")
puts 'hello from cosm'
test("smoke", ->() { assert true })
require("cosm/test")
describe("smoke section", ->() { test("smoke", ->() { assert(true) }) })
cosm.test.test("smoke", ->() { assert(true) })
cosm.test.describe("more smoke", ->() { test("nested", ->() { assert(true) }) })
cosm.test.expectEqual([1, 2], [1, 2])
require("app/app.cosm")
app.App.build().class.name
cosm.test.summary()
cosm.test.name
cosm.modules.test.name
Kernel.class.name
Kernel.inspect(Kernel)
http.class.name
cosm.http.class.name
Time.now()
Time.isoNow()
Time.iso(0)
Time.fromIso("1970-01-01T00:00:00.000Z")
Process.cwd()
Process.argv()
Process.platform()
Process.arch()
Process.env("HOME")
Kernel.sleep(0)
Kernel.uuid()
Kernel.escapeHtml("<tag>")
Kernel.tryEval("1 + 2").inspect
Kernel.tryValidate({ count: 2 }, Data.model("Count", { count: Data.number() })).value
Session.default().history().length
Kernel.blockGiven()
Random.float()
Random.int(10)
Random.choice(["red", "green", "blue"])
Mirror.reflect({ answer: 42 }).inspect()
Mirror.reflect(Kernel).get(:assert)
Kernel.expectEqual([1, 2], [1, 2])
HttpResponse.html("<h1>ok</h1>", 200)
HttpResponse.text("ok", 201)
HttpResponse.json({ ok: true }, 202)
let router = HttpRouter.new()
router.use do |req, next|
  next()
end
router.draw do
  get "/" do |req|
    HttpResponse.html("""<h1>Hello #{req.path}</h1>""", 200)
  end
end
Kernel.dispatch(1, Symbol.intern("plus"), 2)
Kernel.method(:assert).name
Kernel.method(:assert).call(true)
cosm.Kernel.assert(true)
cosm.classes.Array.name
cosm.version
cosm.get(:version)
classes.get(:Kernel).name
cosm.values().length
:status.name
Symbol.intern("status").name
1.send(:plus, 2)
classes.Kernel.methods.assert.name
classes.Http.methods.serve.name
classes.HttpServer.methods.stop.name
classes.Object.methods.send.name
classes.Class.methods.new.name
classes.Function.methods.call.name
classes.Symbol.classMethods.intern.name
classes.Kernel.methods.assert.name
1.send(Symbol.intern("plus"), 2)
[1, 2].class.name
"cosm".length
{ answer: 42 }.length
{ answer: 42 }.answer
"co" + "sm"
do let x = 1; x + 2 end
```

## Notes

- Identifiers resolve lexically first, then fall back to the built-in/global repository.
- Inside `router.draw(...)`, bare verb calls like `get(...)` and `post(...)` are handled through a tiny builder receiver that uses `does_not_understand(message, args)` under the hood. That keeps the first routing DSL object-first and runtime-backed rather than introducing route-specific syntax.
- `router.draw do ... end` and `get "/" do |req| ... end` are the intended `0.3.12.x` routing ergonomics boundary. They are still just final-argument block sugar over the existing callable model, not a full block system.
- Hash keys are currently identifier keys, not string keys.
- Current reserved words include `class`, `def`, `do`, `else`, `end`, `if`, `let`, `then`, `true`, and `false`.
- `self` is reserved for method bodies.
- `@name` reads instance fields through the current `self` and is only valid when `self` is bound to an object instance.
- Line comments use `# ...`.
- `if` requires `else` in the current version.
- String interpolation uses Ruby-style `#{...}` inside double-quoted strings.
- Single-quoted strings do not interpolate.
- Interpolation currently accepts values that can already be string-concatenated: strings, numbers, and booleans.
- Triple-quoted strings remain the small inline multiline template form in `0.3.12.x`; `.ecosm` is now the intended path for larger app-facing HTML templates, and prompt execution stays explicit through `Prompt.text(...)` or `cosm.ai`.
- `.ecosm` templates may interpolate ordinary `#{...}` expressions, preferred `<%= ... %>` expressions, and in `0.3.12.x` may also consume `yield()` for single-slot layout composition without stealing ordinary context keys.
- `methods()` on live receivers is now the intended everyday reflection path; `Mirror` stays the readonly wrapper path, and `.methods` / `.classMethods` on class objects remain the explicit class-table views.
- `class` currently supports `init`-driven constructor fields, reflective class objects, `Class.new(...)`, instance method send via `obj.method(...)`, and explicit class methods via `def self.name(...)`.
- `class << self ... end` is now available as an explicit class-side authoring form and is currently equivalent to `def self.name(...)`.
- `Class` is currently the bootstrap anchor for a minimal metaclass model: ordinary classes have their own metaclass objects, metaclasses are instances of `Class`, and metaclass superclasses currently mirror the ordinary class hierarchy.
- `Point.class` and `Point.metaclass` are currently the same reflective object. The explicit `.metaclass` spelling exists to make the bootstrap model easier to inspect while it is still settling.
- `assert` still exists as a convenience global, but `Kernel.assert(...)` is the clearer long-term shape.
- `puts` also exists as a convenience global alias for `Kernel.puts(...)`.
- `print`, `warn`, and `test` now also exist as convenience global aliases for `Kernel.print(...)`, `Kernel.warn(...)`, and `Kernel.test(...)`.
- `resetTests` and `testSummary` also exist as convenience global aliases, though `cosm.test.reset()` / `cosm.test.summary()` remain a better long-term shape.
- `require("cosm/test")` still parses as a statement. It injects `test`, `describe`, `expectEqual`, `resetTests`, and `testSummary` into the current scope and returns the same `Module` object exposed as `cosm.test`.
- `require("path/to/file.cosm")` also parses as a statement. It returns a reflective `Module` object and injects a basename-style module binding such as `app` for `require("app/app.cosm")`.
- `Kernel.puts(...)` is the first real stdio-oriented primitive on `Kernel`; at the moment it writes directly to stdout and returns the printed value.
- `Kernel.warn(...)` currently writes directly to stderr and returns the printed value.
- `Kernel.test(...)` is intentionally small and bootstrap-oriented: it runs a callable, prints a TAP-like `ok`/`not ok` line, and returns a boolean result.
- `Kernel.describe(...)` is the current lightweight grouping primitive for Cosm-native tests; it prints a section header and then invokes a callable.
- `def` and `class` currently allow a small parser convenience where `do` may be omitted before `end`.
- Statement separators are still semicolon-oriented at the grammar level, but the parser now performs a conservative newline-to-semicolon normalization pass for common one-statement-per-line code.
- Parenthesis-free call sugar is currently narrow and statement-oriented; it exists mainly for lightweight convenience calls such as `assert true` and `puts 'hello'`.
- `:name` is syntax sugar for an interned symbol value, and `Symbol.intern("name")` exposes the same underlying TS runtime symbol model directly.
- `receiver.send(message, ...)` is the ordinary explicit message-passing path, and `Kernel.dispatch(receiver, message, ...)` is the helper-form dispatch API when you already have a receiver value.
- Missing instance sends can now fall back through `does_not_understand(message, args)` when an object defines it. This is the first small DSL-oriented dispatch hook, and it does not yet include splats or block capture.
- `Kernel.inspect`, `Kernel.send`, `Kernel.dispatch`, `Kernel.trace`, and `Kernel.readline` now live on the TS-backed `Kernel` runtime value rather than only being interpreter-installed helpers.
- `http` is the first intentionally small host-service object; it currently focuses on server startup and a tiny request/response boundary, not a full framework.
- `HttpRouter` is intentionally exact-path and object-first in `0.3.12.x`; route params, wildcards, middleware groups/macros, and richer route DSLs are still deferred.
- `Mirror` is intentionally readonly and observational in `0.3.12.x`; it is not yet a JS bridge, proxy, or hologram-style presenter.
- Receiver-side `methods()` is now a symbol-list surface. Class-table `.methods` and `.classMethods` still return reflective objects, so dot access like `classes.Kernel.methods.assert` continues to work.
- Built-in reflective method tables like `classes.Object.methods`, `classes.Class.methods`, `classes.Function.methods`, `classes.Method.methods`, `classes.Symbol.methods`, `classes.Namespace.methods`, and `classes.Kernel.methods` now come from the same explicit TS-backed exposure protocol that native lookup uses at runtime.
- `method(:name)` and `classMethod(:name)` now return first-class `Method` objects, which can be invoked either directly like functions or via `.call(...)`.
- Built-in numeric and string addition now also routes through `plus` message sends, so `1.plus(2)` and `"co".plus("sm")` match `+`.
- Some primitive behavior now lives directly on the TS runtime value classes, and the interpreter consults those native properties/methods before falling back to repository/class lookup.
- `Kernel`, `classes`, and `cosm` now also have clearer named runtime classes (`Kernel` and `Namespace`) rather than always appearing as anonymous `Object` bags. `Namespace` currently owns `length`, `keys`, `values`, `has`, and `get` natively.
- `Module` is now a distinct runtime class from `Namespace`. `cosm.test` is a `Module`, while `cosm.modules` remains a `Namespace` that indexes module objects.
- Strings, arrays, and hashes now expose `.length` directly; the old global `len` helper has been removed.
- Loops and reassignment are not implemented yet.

## Explicitly Not In 0.3.12.x

- ampersand block capture or forwarding
- route params, wildcards, middleware groups, and route macros
- `Data` syntax or model-declaration syntax
- Slack/MCP tool ecosystems or generalized persistent agent-runtime surfaces
- HTML tag-builder DSLs
- browser-side Cosm runtime
- richer notebook/session management
- JS interop mirrors/holograms
- full VM execution
