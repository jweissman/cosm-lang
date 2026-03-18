import * as ohm from 'ohm-js';
import rawGrammar from "../lang/cosm.ohm.txt";
import { SurfaceNode, CoreNode } from "../types";
import { Lowerer } from "./lowerer";

export class Parser {
    private static listChildren(node: SurfaceNode): SurfaceNode[] {
      const children = node.children ?? [];
      if (children[0]?.kind === 'list') {
        return children[0].children ?? [];
      }
      return children;
    }

    private static paramNames(node: SurfaceNode): string[] {
      return this.listChildren(node).map((param) => param.value);
    }

    static parseSurface(input: string): SurfaceNode {
      const grammar = ohm.grammar(rawGrammar);
      const semantics = grammar.createSemantics().addOperation('ast', {
        _iter(...children) {
          return {
            kind: 'list',
            value: '',
            children: children.map((child) => child.ast()),
          };
        },
        Program: (statements) => ({
          kind: 'program',
          value: '',
          children: [statements.ast()],
        }),
        StatementList: (first, rest, _trailing) => ({
          kind: 'statement_list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        StatementTail: (_sep, statement) => statement.ast(),
        Statement: (statement) => ({
          kind: 'statement',
          value: '',
          left: statement.ast(),
        }),
        ClassStmt: (_class, name, superclass, _do, body, _end) => {
          const superclassNode = superclass.ast();
          return {
            kind: 'class_stmt',
            value: name.sourceString,
            left: superclassNode.kind === 'list' ? superclassNode.children?.[0] : superclassNode,
            children: Parser.listChildren(body.ast()),
          };
        },
        ClassSuper: (_open, name, _close) => ({
          kind: 'class_super',
          value: name.sourceString,
        }),
        ClassBody: (members) => ({
          kind: 'class_body',
          value: '',
          children: members.children.map((child) => child.ast()),
        }),
        ClassMember: (member, _semi) => member.ast(),
        DefStmt: (_def, name, _open, params, _close, _do, body, _end) => ({
          kind: 'def_stmt',
          value: name.sourceString,
          params: Parser.paramNames(params.ast()),
          children: [{ kind: 'block_expr', value: '', children: Parser.listChildren(body.ast()) }],
        }),
        LetStmt: (_let, name, _eq, expr) => ({
          kind: 'let_stmt',
          value: name.sourceString,
          left: expr.ast(),
        }),
        Exp: (exp) => exp.ast(),
        IfExp_full: (_if, condition, _then, thenBody, _else, elseBody, _end) => ({
          kind: 'if_expr',
          value: '',
          left: condition.ast(),
          children: [
            { kind: 'block_expr', value: '', children: Parser.listChildren(thenBody.ast()) },
            { kind: 'block_expr', value: '', children: Parser.listChildren(elseBody.ast()) },
          ],
        }),
        PriExp_block: (_do, body, _end) => ({
          kind: 'block_expr',
          value: '',
          children: Parser.listChildren(body.ast()),
        }),
        PriExp_lambda: (_arrow, _open, params, _close, _lbrace, body, _rbrace) => ({
          kind: 'lambda_expr',
          value: '<lambda>',
          params: Parser.paramNames(params.ast()),
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
        }),
        OrExp_or: (left, _op, right) => ({ kind: 'or', value: '', left: left.ast(), right: right.ast() }),
        AndExp_and: (left, _op, right) => ({ kind: 'and', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_eq: (left, _op, right) => ({ kind: 'eq', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_neq: (left, _op, right) => ({ kind: 'neq', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_lt: (left, _op, right) => ({ kind: 'lt', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_lte: (left, _op, right) => ({ kind: 'lte', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_gt: (left, _op, right) => ({ kind: 'gt', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_gte: (left, _op, right) => ({ kind: 'gte', value: '', left: left.ast(), right: right.ast() }),
        AddExp_plus: (left, _op, right) => ({ kind: 'add', value: '', left: left.ast(), right: right.ast() }),
        AddExp_minus: (left, _op, right) => ({ kind: 'subtract', value: '', left: left.ast(), right: right.ast() }),
        MulExp_times: (left, _op, right) => ({ kind: 'multiply', value: '', left: left.ast(), right: right.ast() }),
        MulExp_divide: (left, _op, right) => ({ kind: 'divide', value: '', left: left.ast(), right: right.ast() }),
        ExpExp_power: (left, _op, right) => ({ kind: 'pow', value: '', left: left.ast(), right: right.ast() }),
        UnaryExp_not: (_op, expr) => ({ kind: 'not', value: '', left: expr.ast() }),
        UnaryExp_pos: (_op, expr) => ({ kind: 'pos', value: '', left: expr.ast() }),
        UnaryExp_neg: (_op, expr) => ({ kind: 'neg', value: '', left: expr.ast() }),
        PostExp_access: (left, _dot, property) => ({ kind: 'access', value: property.sourceString, left: left.ast() }),
        PostExp_call: (callee, _open, args, _close) => ({
          kind: 'call',
          value: '',
          left: callee.ast(),
          children: Parser.listChildren(args.ast()),
        }),
        PriExp_paren: (_open, exp, _close) => exp.ast(),
        PriExp_array: (_open, items, _close) => ({
          kind: 'array',
          value: '',
          children: Parser.listChildren(items.ast()),
        }),
        PriExp_hash: (_open, entries, _close) => ({
          kind: 'hash',
          value: '',
          children: Parser.listChildren(entries.ast()),
        }),
        CallArgs: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        ArrayItems: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        HashItems: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        ParamList: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        HashEntry: (key, _colon, value) => ({ kind: 'pair', value: key.sourceString, left: value.ast() }),
        string: (_open, parts, _close) => {
          const children = Parser.listChildren(parts.ast());
          const isPlain = children.every((child) => child.kind === 'string' && !(child.children?.length));
          if (isPlain) {
            return {
              kind: 'string',
              value: children.map((child) => child.value).join(''),
            };
          }
          return {
            kind: 'string',
            value: '',
            children,
          };
        },
        stringPart_interp: (interpolation) => interpolation.ast(),
        stringPart_text: (text) => text.ast(),
        stringPart_escape: (_slash, escape) => escape.ast(),
        interpolation: (_open, expr, _close) => expr.ast(),
        stringText_plain: (char) => ({ kind: 'string', value: char.sourceString }),
        stringText_hash: (hash) => ({ kind: 'string', value: hash.sourceString }),
        escape_quote: (_quote) => ({ kind: 'string', value: '"' }),
        escape_slash: (_slash) => ({ kind: 'string', value: "\\" }),
        escape_newline: (_newline) => ({ kind: 'string', value: "\n" }),
        escape_tab: (_tab) => ({ kind: 'string', value: "\t" }),
        boolean_true: (_value) => ({ kind: 'bool', value: 'true' }),
        boolean_false: (_value) => ({ kind: 'bool', value: 'false' }),
        self: (_value) => ({ kind: 'ident', value: 'self' }),
        number_whole: (digits) => ({ kind: 'number', value: digits.sourceString }),
        number_fract: (whole, _dot, fraction) => ({
          kind: 'number',
          value: `${whole.sourceString}.${fraction.sourceString}`,
        }),
        ident: (_fst, chars) => ({ kind: 'ident', value: _fst.sourceString + chars.sourceString }),
      });

      const matchResult = grammar.match(input);
      if (matchResult.succeeded()) {
        return semantics(matchResult).ast();
      }
      throw new Error("Parse error: " + matchResult.message);
    }

    static parse(input: string): CoreNode {
      return Lowerer.lower(this.parseSurface(input));
    }
  }
