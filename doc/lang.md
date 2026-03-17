# Cosm Language Reference

## Current Surface

Cosm currently evaluates a small expression language with semicolon-separated programs.

Programs also support simple local bindings with `let`.

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

### Programs

Programs may contain multiple expressions separated by `;`. The value of the last expression is the program result.

```cosm
let label = "co" + "sm";
assert(1 + 1 == 2);
assert(label == "cosm");
assert(len([1, 2, 3]) == 3);
42
```

### Bindings

- `let name = expr`

`let` introduces a program-scoped local binding for the rest of the current file or input. There are no nested block scopes yet, and duplicate local names are rejected.

```cosm
let answer = 40;
let label = "co" + "sm";
assert(label == "cosm");
answer + 2
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
```

## Notes

- Identifiers currently resolve from the built-in global repository only.
- Program-scoped `let` locals are checked before built-in globals.
- Hash keys are currently identifier keys, not string keys.
- Calls currently target built-in functions only.
- String interpolation is not implemented yet; use `+` for now.
- There are no blocks or nested scopes yet.
