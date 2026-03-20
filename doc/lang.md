# Cosm Language Reference

## Current Surface

Cosm currently evaluates a small expression language with semicolon-separated programs, lexical blocks, `if` expressions, stabby lambdas, and named `def` functions.

Programs also support lexical local bindings with `let`.

Line comments starting with `#` are ignored anywhere whitespace is allowed.

### Literals

- Numbers: `1`, `2.5`
- Booleans: `true`, `false`
- Double-quoted strings: `"cosm"`, `"line\nbreak"`
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

### Callables

- Lambdas: `->(arg1, arg2) { expr }`
- Named defs: `def name(arg1, arg2) do ... end`

### Classes

- `class Name do ... end`
- `class Name < Superclass do ... end`

Class bodies currently support instance methods via `def name(...)` and explicit class methods via `def self.name(...)`. A method named `init` defines constructor arity and field names; its parameter list becomes the class's declared fields. Class definitions bind a class value, appear in `classes`, and expose collected slots and methods through `.slots`, `.methods`, and `.classMethods`.
Instances can be created with `ClassName.new(...)`, and constructor arguments are assigned positionally to the fields implied by `init`. Instance methods can refer to `self`, and `init` bodies run after those fields are assigned.
Inside instance methods, `@name` is shorthand for reading the instance field named `name`. This makes object-state provenance explicit without replacing `self.name`.
Class objects can receive methods too, but only when those methods are declared explicitly with `def self.name(...)`.
Ordinary classes now reflect through minimal per-class metaclasses, while `Class` remains the bootstrap anchor. That means `Point.class.name` and `Point.metaclass.name` are both `Point class`, `Point.metaclass.class.name` is `Class`, and `Class.class.name` stays `Class`.
At the moment, `.class` on a class object is intentionally the same reflective link as `.metaclass`. That is transparent, but still somewhat provisional; richer class-side authoring syntax may come later once the underlying model feels less surprising.

### Control Flow

- Blocks: `do ... end`
- Conditional expressions: `if cond then ... else ... end`

### Programs

Programs may contain multiple expressions separated by `;`. The value of the last expression is the program result.
At statement position, simple convenience calls may also omit parentheses, so forms like `assert true` and `puts 'hello'` are accepted as sugar for ordinary calls.

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

### Functions

- `->() { expr }`
- `->(arg1, arg2) { expr }`
- `def name(arg1, arg2) do ... end`

Lambdas are one-line expression functions. `def` introduces named functions with `do ... end` bodies. Both capture outer lexical bindings, bind parameters in their call scope, and return the last value of their body.

```cosm
let prefix = "co";
let join = ->(rest) { prefix + rest };
join("sm")
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
- `Kernel.test(name, fn)`
  Runs a zero-argument function or method, prints a tiny pass/fail line, and returns `true` or `false`.
- `puts(value)`
  Convenience global alias for `Kernel.puts(value)`.
- `print(value)`
  Convenience global alias for `Kernel.print(value)`.
- `test(name, fn)`
  Convenience global alias for `Kernel.test(name, fn)`.
- `Kernel.inspect(value)`
  Returns the Cosm-oriented inspected string for a value.
- `Kernel.send(receiver, message, ...args)`
  Performs an explicit message send where `message` is a string or symbol.
- `value.method(message)`
  Returns a bound `Method` object for a method on a receiver. On class objects, this introspects instance methods.
- `ClassValue.classMethod(message)`
  Returns a bound class-side `Method` object for a class object.
- `fn.call(arg1, arg2)`
  Invokes a first-class function explicitly through the object model.

### Built-in Repository

- `classes`
  Reflective object containing core classes.
- `Kernel`
  Reflective object for ambient services. `Kernel.class.name` is `Kernel`, and `classes.Kernel` is the reflective class object behind it.
- `cosm`
  Reflective root object currently exposing `Kernel`, `classes`, and `version`.
  `cosm.length`, `cosm.keys()`, `cosm.values()`, `cosm.has(:name)`, and `cosm.get(:name)` now work through the `Namespace` runtime model.
- `Symbol`
  Built-in class for interned symbols via `:name` literals or `Symbol.intern("name")`.
- User-defined classes also appear in `classes` within the current evaluation/session scope.
- Core classes:
  `Class`, `Object`, `Number`, `Boolean`, `String`, `Array`, `Hash`, `Function`

Examples:

```cosm
classes.Array.name
Kernel.assert(true)
Kernel.print("hello")
Kernel.puts("hello from cosm")
puts 'hello from cosm'
test("smoke", ->() { assert true })
Kernel.class.name
Kernel.inspect(Kernel)
Kernel.send(1, Symbol.intern("plus"), 2)
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
classes.Kernel.method(:assert).name
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
- Hash keys are currently identifier keys, not string keys.
- Current reserved words include `class`, `def`, `do`, `else`, `end`, `if`, `let`, `then`, `true`, and `false`.
- `self` is reserved for method bodies.
- `@name` reads instance fields through the current `self` and is only valid when `self` is bound to an object instance.
- Line comments use `# ...`.
- `if` requires `else` in the current version.
- String interpolation uses Ruby-style `#{...}` inside double-quoted strings.
- Single-quoted strings do not interpolate.
- Interpolation currently accepts values that can already be string-concatenated: strings, numbers, and booleans.
- `class` currently supports `init`-driven constructor fields, reflective class objects, `Class.new(...)`, instance method send via `obj.method(...)`, and explicit class methods via `def self.name(...)`.
- `Class` is currently the bootstrap anchor for a minimal metaclass model: ordinary classes have their own metaclass objects, metaclasses are instances of `Class`, and metaclass superclasses currently mirror the ordinary class hierarchy.
- `Point.class` and `Point.metaclass` are currently the same reflective object. The explicit `.metaclass` spelling exists to make the bootstrap model easier to inspect while it is still settling.
- `assert` still exists as a convenience global, but `Kernel.assert(...)` is the clearer long-term shape.
- `puts` also exists as a convenience global alias for `Kernel.puts(...)`.
- `print` and `test` now also exist as convenience global aliases for `Kernel.print(...)` and `Kernel.test(...)`.
- `Kernel.puts(...)` is the first real stdio-oriented primitive on `Kernel`; at the moment it writes directly to stdout and returns the printed value.
- `Kernel.test(...)` is intentionally small and bootstrap-oriented: it runs a callable, prints a TAP-like `ok`/`not ok` line, and returns a boolean result.
- Parenthesis-free call sugar is currently narrow and statement-oriented; it exists mainly for lightweight convenience calls such as `assert true` and `puts 'hello'`.
- `:name` is syntax sugar for an interned symbol value, and `Symbol.intern("name")` exposes the same underlying TS runtime symbol model directly.
- `send` is now available both as `Kernel.send(receiver, message, ...)` and `receiver.send(message, ...)`, which gives us a more explicit message-passing path while the broader dispatch model settles.
- `Kernel.inspect` and `Kernel.send` now live on the TS-backed `Kernel` runtime value rather than only being interpreter-installed helpers.
- `methods` and `classMethods` currently return ordinary reflective objects, so dot access like `classes.Kernel.methods.assert` works. Bracket indexing like `methods[:assert]` is not implemented yet.
- `method(:name)` and `classMethod(:name)` now return first-class `Method` objects, which can be invoked either directly like functions or via `.call(...)`.
- Built-in numeric and string addition now also routes through `plus` message sends, so `1.plus(2)` and `"co".plus("sm")` match `+`.
- Some primitive behavior now lives directly on the TS runtime value classes, and the interpreter consults those native properties/methods before falling back to repository/class lookup.
- `Kernel`, `classes`, and `cosm` now also have clearer named runtime classes (`Kernel` and `Namespace`) rather than always appearing as anonymous `Object` bags. `Namespace` currently owns `length`, `keys`, `values`, `has`, and `get` natively.
- Strings, arrays, and hashes now expose `.length` directly; the old global `len` helper has been removed.
- Loops and reassignment are not implemented yet.
