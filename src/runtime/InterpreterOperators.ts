import { CoreNode, CosmEnv, CosmValue } from "../types";

type OperatorHooks = {
  evalNode: (ast: CoreNode, env: CosmEnv) => CosmValue;
  expectChild: (ast: CoreNode, op: string) => CoreNode;
  expectChildren: (ast: CoreNode, op: string) => [CoreNode, CoreNode];
  send: (receiver: CosmValue, message: string, args: CosmValue[], env?: CosmEnv) => CosmValue;
  invokeFunction: (callee: CosmValue, args: CosmValue[], selfValue?: CosmValue, env?: CosmEnv, currentBlock?: CosmValue) => CosmValue;
};

export class InterpreterOperators {
  static evalAdd(ast: CoreNode, env: CosmEnv, hooks: OperatorHooks): CosmValue {
    const [leftAst, rightAst] = hooks.expectChildren(ast, "add");
    const left = hooks.evalNode(leftAst, env);
    const right = hooks.evalNode(rightAst, env);
    try {
      return hooks.send(left, "plus", [right], env);
    } catch (error) {
      if (error instanceof Error && error.message.includes("has no property 'plus'")) {
        throw new Error("Type error: add expects numeric operands or string concatenation");
      }
      throw error;
    }
  }

  static evalArithmeticSend(
    ast: CoreNode,
    message: "subtract" | "multiply" | "divide" | "pow",
    env: CosmEnv,
    fallbackMessage: string,
    hooks: OperatorHooks,
  ): CosmValue {
    const [leftAst, rightAst] = hooks.expectChildren(ast, message);
    const left = hooks.evalNode(leftAst, env);
    const right = hooks.evalNode(rightAst, env);
    try {
      return hooks.send(left, message, [right], env);
    } catch (error) {
      if (error instanceof Error && error.message.includes(`'${message}'`)) {
        throw new Error(`Type error: ${fallbackMessage}`);
      }
      throw error;
    }
  }

  static evalLogicSend(ast: CoreNode, message: "and" | "or", env: CosmEnv, hooks: OperatorHooks): CosmValue {
    const [leftAst, rightAst] = hooks.expectChildren(ast, message);
    const left = hooks.evalNode(leftAst, env);
    const right = hooks.evalNode(rightAst, env);
    try {
      return hooks.send(left, message, [right], env);
    } catch (error) {
      if (error instanceof Error && error.message.includes(`'${message}'`)) {
        throw new Error(`Type error: ${message} expects boolean operands`);
      }
      throw error;
    }
  }

  static evalUnarySend(
    ast: CoreNode,
    message: "pos" | "neg" | "not",
    env: CosmEnv,
    fallbackMessage: string,
    hooks: OperatorHooks,
  ): CosmValue {
    const child = hooks.evalNode(hooks.expectChild(ast, message), env);
    try {
      return hooks.send(child, message, [], env);
    } catch (error) {
      if (error instanceof Error && error.message.includes(`'${message}'`)) {
        throw new Error(`Type error: ${fallbackMessage}`);
      }
      throw error;
    }
  }

  static evalEquality(ast: CoreNode, shouldEqual: boolean, env: CosmEnv, hooks: OperatorHooks): boolean {
    const [leftAst, rightAst] = hooks.expectChildren(ast, shouldEqual ? "eq" : "neq");
    const left = hooks.evalNode(leftAst, env);
    const right = hooks.evalNode(rightAst, env);
    const result = hooks.send(left, "eq", [right], env);
    if (result.type !== "bool") {
      throw new Error("Type error: method eq must return a boolean");
    }
    const equal = result.value;
    return shouldEqual ? equal : !equal;
  }

  static evalComparison(ast: CoreNode, op: "lt" | "lte" | "gt" | "gte", env: CosmEnv, hooks: OperatorHooks): boolean {
    const [leftAst, rightAst] = hooks.expectChildren(ast, op);
    const left = hooks.evalNode(leftAst, env);
    const right = hooks.evalNode(rightAst, env);
    const result = this.tryNativePredicate(left, op, right, hooks);
    if (result === null) {
      throw new Error(`Type error: ${op} expects numeric operands`);
    }
    return result;
  }

  static evalSemanticEquality(ast: CoreNode, env: CosmEnv, hooks: OperatorHooks): CosmValue {
    const [leftAst, rightAst] = hooks.expectChildren(ast, "semantic_eq");
    const left = hooks.evalNode(leftAst, env);
    const right = hooks.evalNode(rightAst, env);
    return hooks.send(left, "semanticEq", [right], env);
  }

  private static tryNativePredicate(
    left: CosmValue,
    message: "eq" | "lt" | "lte" | "gt" | "gte",
    right: CosmValue,
    hooks: OperatorHooks,
  ): boolean | null {
    const nativeMethod = left.nativeMethod(message);
    if (!nativeMethod) {
      return null;
    }
    const result = hooks.invokeFunction(nativeMethod, [right], left);
    if (result.type !== "bool") {
      throw new Error(`Type error: method ${message} must return a boolean`);
    }
    return result.value;
  }
}
