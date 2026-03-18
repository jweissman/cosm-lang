# Cosm Language Reference

## Current Surface

Cosm currently evaluates a small expression language with semicolon-separated programs, lexical blocks, `if` expressions, stabby lambdas, and named `def` functions.

Programs also support lexical local bindings with `let`.

Line comments starting with `#` are ignored anywhere whitespace is allowed.

### Literals

- Numbers: `1`, `2.5`
- Booleans: `true`, `false`
- Strings: `"cosm"`, `"line\nbreak"`
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
- `class Name(Superclass) do ... end`

Class bodies currently support `def` members. This first slice is reflective: class definitions bind a class value, appear in `classes`, and expose collected methods through `.methods`.

### Control Flow

- Blocks: `do ... end`
- Conditional expressions: `if cond then ... else ... end`

### Programs

Programs may contain multiple expressions separated by `;`. The value of the last expression is the program result.

```cosm
let label = "co" + "sm";
assert(1 + 1 == 2);
assert(label == "cosm");
assert((if true then 1 else 2 end) == 1);
assert(len([1, 2, 3]) == 3);
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
  def greet(name) do
    "hello " + name
  end
end;

Greeter.methods.greet.name
```

### Built-ins

- `assert(condition)`
- `assert(condition, message)`
  Raises `Assertion failed` unless `condition` evaluates to `true`. With a message, it raises `Assertion failed: <message>`.
- `len(value)`
  Works on arrays and hashes.

### Built-in Repository

- `classes`
  Reflective object containing core classes.
- User-defined classes also appear in `classes` within the current evaluation/session scope.
- Core classes:
  `Object`, `Number`, `Boolean`, `String`, `Array`, `Hash`, `Function`

Examples:

```cosm
classes.Array.name
[1, 2].class.name
{ answer: 42 }.answer
"co" + "sm"
do let x = 1; x + 2 end
```

## Notes

- Identifiers currently resolve from the built-in global repository only.
- Innermost lexical locals are checked before outer locals and built-in globals.
- Hash keys are currently identifier keys, not string keys.
- Current reserved words include `class`, `def`, `do`, `else`, `end`, `if`, `let`, `then`, `true`, and `false`.
- Line comments use `# ...`.
- `if` requires `else` in the current version.
- String interpolation uses Ruby-style `#{...}` inside double-quoted strings.
- Interpolation currently accepts values that can already be string-concatenated: strings, numbers, and booleans.
- `class` currently defines reflective class objects and method collections; instance creation and method send are still future work.
- Loops and reassignment are not implemented yet.
