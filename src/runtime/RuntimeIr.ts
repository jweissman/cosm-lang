import { Construct } from "../Construct";
import { CoreNode, CosmEnv, CosmValue, IrInstruction, IrProgram } from "../types";
import { RuntimeDispatch, RuntimeRepository } from "./RuntimeDispatch";

type IrRuntimeHooks = {
  lookupName: (name: string, env: CosmEnv) => CosmValue;
  lookupProperty: (receiver: CosmValue, property: string) => CosmValue;
  invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv) => CosmValue;
  send: (receiver: CosmValue, message: string, args: CosmValue[], env?: CosmEnv) => CosmValue;
  internSymbol: (name: string) => CosmValue;
  createEnv: (parent?: CosmEnv) => CosmEnv;
  repository: RuntimeRepository;
};

export class RuntimeIr {
  static compile(ast: CoreNode): IrProgram {
    const instructions: IrInstruction[] = [];
    this.compileNode(ast, instructions);
    instructions.push({ op: "return" });
    return { kind: "ir_program", instructions };
  }

  static execute(program: IrProgram, env: CosmEnv, hooks: IrRuntimeHooks): CosmValue {
    const stack: CosmValue[] = [];
    let currentEnv = env;

    const popValue = (): CosmValue => {
      const value = stack.pop();
      if (!value) {
        throw new Error("VM error: stack underflow");
      }
      return value;
    };

    const popArgs = (argc: number): CosmValue[] => {
      const args = new Array<CosmValue>(argc);
      for (let index = argc - 1; index >= 0; index -= 1) {
        args[index] = popValue();
      }
      return args;
    };

    for (let index = 0; index < program.instructions.length; index += 1) {
      const instruction = program.instructions[index];
      switch (instruction.op) {
        case "push_number":
          stack.push(Construct.number(instruction.value));
          break;
        case "push_bool":
          stack.push(Construct.bool(instruction.value));
          break;
        case "push_string":
          stack.push(Construct.string(instruction.value));
          break;
        case "push_symbol":
          stack.push(hooks.internSymbol(instruction.value));
          break;
        case "build_array": {
          const items = popArgs(instruction.length);
          stack.push(Construct.array(items));
          break;
        }
        case "build_hash": {
          const values = popArgs(instruction.keys.length);
          stack.push(Construct.hash(Object.fromEntries(
            instruction.keys.map((key, index) => [key, values[index]]),
          )));
          break;
        }
        case "load_name":
          stack.push(hooks.lookupName(instruction.name, currentEnv));
          break;
        case "store_name": {
          const value = popValue();
          if (Object.hasOwn(currentEnv.bindings, instruction.name) && !currentEnv.allowTopLevelRebinds) {
            throw new Error(`Name error: duplicate local '${instruction.name}'`);
          }
          currentEnv.bindings[instruction.name] = value;
          break;
        }
        case "load_property": {
          const receiver = popValue();
          stack.push(hooks.lookupProperty(receiver, instruction.name));
          break;
        }
        case "call": {
          const args = popArgs(instruction.argc);
          const callee = popValue();
          stack.push(hooks.invokeFunction(callee, args, undefined, currentEnv));
          break;
        }
        case "call_access": {
          const args = popArgs(instruction.argc);
          const receiver = popValue();
          stack.push(
            RuntimeDispatch.invokeAccessCall(receiver, instruction.name, args, hooks.repository, hooks.invokeFunction, currentEnv),
          );
          break;
        }
        case "send": {
          const args = popArgs(instruction.argc);
          const receiver = popValue();
          stack.push(hooks.send(receiver, instruction.name, args, currentEnv));
          break;
        }
        case "begin_scope":
          currentEnv = hooks.createEnv(currentEnv);
          break;
        case "end_scope":
          if (!currentEnv.parent) {
            throw new Error("VM error: attempted to end the root scope");
          }
          currentEnv = currentEnv.parent;
          break;
        case "jump":
          index = instruction.target - 1;
          break;
        case "jump_if_false": {
          const condition = popValue();
          if (condition.type !== "bool") {
            throw new Error("Type error: if expects a boolean condition");
          }
          if (!condition.value) {
            index = instruction.target - 1;
          }
          break;
        }
        case "pop":
          popValue();
          break;
        case "return":
          return stack.pop() ?? Construct.bool(true);
        default:
          return this.never(instruction);
      }
    }

    return stack.pop() ?? Construct.bool(true);
  }

  private static compileNode(ast: CoreNode, instructions: IrInstruction[]): void {
    switch (ast.kind) {
      case "program":
      case "block":
        this.compileStatements(ast.children ?? [], instructions, ast.kind === "block");
        return;
      case "if":
      case "ternary":
        this.compileIf(ast, instructions);
        return;
      case "let":
        if (!ast.left) {
          throw new Error("IR compile error: let is missing a value");
        }
        this.compileNode(ast.left, instructions);
        instructions.push({ op: "store_name", name: ast.value });
        instructions.push({ op: "load_name", name: ast.value });
        return;
      case "number":
        instructions.push({ op: "push_number", value: Number(ast.value) });
        return;
      case "bool":
        instructions.push({ op: "push_bool", value: ast.value === "true" });
        return;
      case "string":
        if ((ast.children?.length ?? 0) > 0) {
          throw new Error("IR compile error: interpolated strings are not yet supported in VM mode");
        }
        instructions.push({ op: "push_string", value: ast.value });
        return;
      case "symbol":
        instructions.push({ op: "push_symbol", value: ast.value });
        return;
      case "array":
        for (const child of ast.children ?? []) {
          this.compileNode(child, instructions);
        }
        instructions.push({ op: "build_array", length: (ast.children ?? []).length });
        return;
      case "hash":
        for (const child of ast.children ?? []) {
          if (child.kind !== "pair" || !child.left) {
            throw new Error("IR compile error: hash entries must be key-value pairs");
          }
          this.compileNode(child.left, instructions);
        }
        instructions.push({
          op: "build_hash",
          keys: (ast.children ?? []).map((child) => {
            if (child.kind !== "pair") {
              throw new Error("IR compile error: hash entries must be key-value pairs");
            }
            return child.value;
          }),
        });
        return;
      case "ident":
        instructions.push({ op: "load_name", name: ast.value });
        return;
      case "access": {
        if (!ast.left) {
          throw new Error("IR compile error: access is missing a receiver");
        }
        this.compileNode(ast.left, instructions);
        instructions.push({ op: "load_property", name: ast.value });
        return;
      }
      case "call": {
        const callee = this.expectCallTarget(ast);
        if (callee.kind === "access" && callee.left) {
          this.compileNode(callee.left, instructions);
          for (const child of ast.children ?? []) {
            this.compileNode(child, instructions);
          }
          instructions.push({ op: "call_access", name: callee.value, argc: (ast.children ?? []).length });
          return;
        }
        this.compileNode(callee, instructions);
        for (const child of ast.children ?? []) {
          this.compileNode(child, instructions);
        }
        instructions.push({ op: "call", argc: (ast.children ?? []).length });
        return;
      }
      case "add":
        this.compileBinarySend(ast, "plus", instructions);
        return;
      case "subtract":
        this.compileBinarySend(ast, "subtract", instructions);
        return;
      case "multiply":
        this.compileBinarySend(ast, "multiply", instructions);
        return;
      case "divide":
        this.compileBinarySend(ast, "divide", instructions);
        return;
      case "pow":
        this.compileBinarySend(ast, "pow", instructions);
        return;
      case "eq":
        this.compileBinarySend(ast, "eq", instructions);
        return;
      case "lt":
        this.compileBinarySend(ast, "lt", instructions);
        return;
      case "lte":
        this.compileBinarySend(ast, "lte", instructions);
        return;
      case "gt":
        this.compileBinarySend(ast, "gt", instructions);
        return;
      case "gte":
        this.compileBinarySend(ast, "gte", instructions);
        return;
      default:
        throw new Error(`IR compile error: VM mode does not yet support '${ast.kind}'`);
    }
  }

  private static compileStatements(statements: CoreNode[], instructions: IrInstruction[], isolateScope: boolean): void {
    if (isolateScope) {
      instructions.push({ op: "begin_scope" });
    }
    if (statements.length === 0) {
      instructions.push({ op: "push_bool", value: true });
      if (isolateScope) {
        instructions.push({ op: "end_scope" });
      }
      return;
    }
    statements.forEach((statement, index) => {
      this.compileNode(statement, instructions);
      if (index < statements.length - 1) {
        instructions.push({ op: "pop" });
      }
    });
    if (isolateScope) {
      instructions.push({ op: "end_scope" });
    }
  }

  private static compileIf(ast: CoreNode, instructions: IrInstruction[]): void {
    if (!ast.left) {
      throw new Error("IR compile error: if is missing a condition");
    }
    const [thenBranch, elseBranch] = ast.children ?? [];
    if (!thenBranch || !elseBranch) {
      throw new Error("IR compile error: if is missing then/else branches");
    }
    this.compileNode(ast.left, instructions);
    const jumpIfFalseIndex = instructions.push({ op: "jump_if_false", target: -1 }) - 1;
    this.compileNode(thenBranch, instructions);
    const jumpToEndIndex = instructions.push({ op: "jump", target: -1 }) - 1;
    instructions[jumpIfFalseIndex] = { op: "jump_if_false", target: instructions.length };
    this.compileNode(elseBranch, instructions);
    instructions[jumpToEndIndex] = { op: "jump", target: instructions.length };
  }

  private static compileBinarySend(ast: CoreNode, message: string, instructions: IrInstruction[]): void {
    const [left, right] = this.expectBinaryChildren(ast);
    this.compileNode(left, instructions);
    this.compileNode(right, instructions);
    instructions.push({ op: "send", name: message, argc: 1 });
  }

  private static expectBinaryChildren(ast: CoreNode): [CoreNode, CoreNode] {
    if (!ast.left || !ast.right) {
      throw new Error(`IR compile error: '${ast.kind}' is missing operands`);
    }
    return [ast.left, ast.right];
  }

  private static expectCallTarget(ast: CoreNode): CoreNode {
    if (!ast.left) {
      throw new Error("IR compile error: call is missing a callee");
    }
    return ast.left;
  }

  private static never(_instruction: never): never {
    throw new Error("Unexpected IR instruction");
  }
}
