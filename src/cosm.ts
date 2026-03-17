import * as ohm from 'ohm-js';
import rawGrammar from "./lang/cosm.ohm.txt";

type CosmInt = { type: 'int', value: number };
type CosmString = { type: 'string', value: string };
type CosmValue = CosmInt
  | CosmString

namespace Cosm {
  export class Types {
    static integer(value: number): CosmInt { return { type: 'int', value }; }
    static string(value: string): CosmString { return { type: 'string', value }; }
  }

  type AST = {
    value: string;
    kind: 'int' | 'string' | 'add' | 'subtract' | 'multiply' | 'divide';
    left?: AST;
    right?: AST;
  }
  export class Parser {
    static parse(input: string): AST {
      const grammar = ohm.grammar(rawGrammar);
      const semantics = grammar.createSemantics().addOperation('ast', {
        AddExp_plus: (left, _op, right) => ({ kind: 'add', value: '', left: left.ast(), right: right.ast() }),
        AddExp_minus: (left, _op, right) => ({ kind: 'subtract', value: '', left: left.ast(), right: right.ast() }),
        MulExp_times: (left, _op, right) => ({ kind: 'multiply', value: '', left: left.ast(), right: right.ast() }),
        MulExp_divide: (left, _op, right) => ({ kind: 'divide', value: '', left: left.ast(), right: right.ast() }),
        ExpExp_power: (left, _op, right) => ({ kind: 'pow', value: '', left: left.ast(), right: right.ast() }),
        number: (digits) => ({ kind: 'int', value: digits.sourceString }),
        ident: (_fst, chars) => ({ kind: 'string', value: chars.sourceString }),
      });
      const matchResult = grammar.match(input);
      if (matchResult.succeeded()) {
        const adapter = semantics(matchResult);
        return adapter.ast();
      } else {
        throw new Error("Parse error: " + matchResult.message);
      }
    }
  }

  export class Interpreter {
    static evalNode(ast: AST): CosmValue {
      switch (ast.kind) {
        case 'int':
          return Types.integer(parseInt(ast.value));
        case 'string':
          return Types.string(ast.value);
        case 'add': {
          if (!ast.left || !ast.right) {
            throw new Error("Invalid AST: add node must have left and right children");
          }
          const left = this.evalNode(ast.left);
          const right = this.evalNode(ast.right);
          if (left.type === 'int' && right.type === 'int') {
            return Types.integer(left.value + right.value);
          } else {
            throw new Error("Type error: both operands must be integers");
          }
        }
        // Implement other operations (subtract, multiply, divide) similarly
        default:
          throw new Error("Unknown AST node kind: " + ast.kind);
      }
    }

    static eval(input: string): CosmValue {
      const ast = Parser.parse(input);
      return this.evalNode(ast);
    }
  }

  export class Values {
    static cosmToJS(value: CosmValue): any {
      switch (value.type) {
        case 'int':
          return value.value as number;
        case 'string':
          return value.value as string;
      }
    }
  }
}
export default Cosm;