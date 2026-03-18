# Cosm Language Reference

## Current Surface

Cosm currently evaluates a small expression language with semicolon-separated programs, lexical blocks, `if` expressions, stabby lambdas, and named `def` functions.

Programs also support lexical local bindings with `let`.

### Literals

- Numbers: `1`, `2.5`
- Booleans: `true`, `false`
- Strings: `"cosm"`, `"line\nbreak"`
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

### Built-ins

- `assert(condition)`
- `assert(condition, message)`
  Raises `Assertion failed` unless `condition` evaluates to `true`. With a message, it raises `Assertion failed: <message>`.
- `len(value)`
  Works on arrays and hashes.

### Built-in Repository

- `classes`
  Reflective object containing core classes.
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
- `if` requires `else` in the current version.
- String interpolation is not implemented yet; use `+` for now.
- Loops and reassignment are not implemented yet.
