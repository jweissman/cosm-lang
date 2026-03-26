import * as ohm from 'ohm-js';
import rawGrammar from "../lang/cosm.ohm.txt";
import { SurfaceNode, CoreNode } from "../types";
import { Lowerer } from "./lowerer";

export class Parser {
    private static appendTrailingBlock(callNode: SurfaceNode, trailingBlockAst: SurfaceNode): SurfaceNode {
      const normalizedBlock = trailingBlockAst.kind === 'list'
        ? trailingBlockAst.children?.[0]
        : trailingBlockAst;

      if (!normalizedBlock || normalizedBlock.kind !== 'block_expr') {
        throw new Error('Invalid surface AST: trailing block must lower from a block expression');
      }

      const lambdaAst: SurfaceNode = {
        kind: 'lambda_expr',
        value: '<lambda>',
        params: normalizedBlock.params ?? [],
        defaults: normalizedBlock.defaults ?? {},
        children: [{
          kind: 'block_expr',
          value: '',
          children: normalizedBlock.children ?? [],
        }],
      };

      return {
        ...callNode,
        target: 'trailing_block',
        children: [...(callNode.children ?? []), lambdaAst],
      };
    }

    private static normalizeInput(input: string): string {
      let output = '';
      let lineBuffer = '';
      let inSingle = false;
      let inDouble = false;
      let inTripleDouble = false;
      let escaped = false;
      let inComment = false;

      const flushLine = (newline = '') => {
        const lineWithoutComment = inComment ? lineBuffer.replace(/#.*$/, '') : lineBuffer;
        output += lineBuffer;
        if (newline) {
          output += this.shouldInsertSemicolon(lineWithoutComment) ? `;${newline}` : newline;
        }
        lineBuffer = '';
        inComment = false;
      };

      for (let index = 0; index < input.length; index += 1) {
        const char = input[index];

        if (inComment) {
          if (char === '\n') {
            flushLine('\n');
          } else {
            lineBuffer += char;
          }
          continue;
        }

        if (inTripleDouble) {
          if (input.slice(index, index + 3) === '"""') {
            lineBuffer += '"""';
            index += 2;
            inTripleDouble = false;
            continue;
          }
          lineBuffer += char;
          continue;
        }

        if (inSingle || inDouble) {
          lineBuffer += char;
          if (escaped) {
            escaped = false;
            continue;
          }
          if (char === '\\') {
            escaped = true;
            continue;
          }
          if (inSingle && char === '\'') {
            inSingle = false;
          } else if (inDouble && char === '"') {
            inDouble = false;
          }
          continue;
        }

        if (char === '#') {
          inComment = true;
          lineBuffer += char;
          continue;
        }
        if (char === '\'') {
          inSingle = true;
          lineBuffer += char;
          continue;
        }
        if (input.slice(index, index + 3) === '"""') {
          inTripleDouble = true;
          lineBuffer += '"""';
          index += 2;
          continue;
        }
        if (char === '"') {
          inDouble = true;
          lineBuffer += char;
          continue;
        }
        if (char === '\n') {
          flushLine('\n');
          continue;
        }
        lineBuffer += char;
      }

      flushLine();
      return output;
    }

    private static shouldInsertSemicolon(line: string): boolean {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }
      if (/^[A-Za-z_][A-Za-z0-9_]*\s*:(?!:)/.test(trimmed)) {
        return false;
      }
      if (trimmed.endsWith(';')) {
        return false;
      }
      if (
        /^class\b/.test(trimmed)
        && !/\bend\s*$/.test(trimmed)
      ) {
        return false;
      }
      if (
        /^def\b/.test(trimmed)
        && !/\bend\s*$/.test(trimmed)
      ) {
        return false;
      }
      if (
        trimmed === 'do'
        || trimmed === 'else'
        || /\bthen\s*$/.test(trimmed)
        || /\bdo\s*$/.test(trimmed)
        || /\bdo\s*\|[^|]*\|\s*$/.test(trimmed)
      ) {
        return false;
      }
      if (/[+\-*/^.,=<>!&|?([{:]$/.test(trimmed)) {
        return false;
      }
      return true;
    }

    private static listChildren(node: SurfaceNode): SurfaceNode[] {
      const children = node.children ?? [];
      if (children[0]?.kind === 'list') {
        return children[0].children ?? [];
      }
      return children;
    }

    private static paramSignature(node: SurfaceNode): { params: string[]; defaults: Record<string, SurfaceNode>; restParam?: string } {
      if (node.kind === 'ident') {
        return { params: [node.value], defaults: {} };
      }
      if (node.kind === 'pair') {
        return {
          params: [node.value],
          defaults: node.left ? { [node.value]: node.left } : {},
        };
      }
      if (node.kind === 'string' && node.target === 'rest_param') {
        return { params: [], defaults: {}, restParam: node.value };
      }
      const children = node.children ?? [];
      return children.reduce<{ params: string[]; defaults: Record<string, SurfaceNode>; restParam?: string }>((acc, child, index) => {
        const signature = this.paramSignature(child);
        if (signature.restParam && index !== children.length - 1) {
          throw new Error('Invalid surface AST: rest parameter must be trailing');
        }
        if (acc.restParam && (signature.restParam || signature.params.length > 0)) {
          throw new Error('Invalid surface AST: rest parameter must be trailing');
        }
        return {
          params: [...acc.params, ...signature.params],
          defaults: { ...acc.defaults, ...signature.defaults },
          restParam: acc.restParam ?? signature.restParam,
        };
      }, { params: [], defaults: {} });
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
        AssignStmt: (name, _eq, expr) => ({
          kind: 'assign_stmt',
          value: name.sourceString,
          left: expr.ast(),
        }),
        BareCallStmt_args: (callee, args, trailingBlock) => {
          const callNode: SurfaceNode = {
            kind: 'call',
            value: '',
            left: callee.ast(),
            children: Parser.listChildren(args.ast()),
          };
          const trailingAst = trailingBlock.ast();
          if (trailingAst.kind === 'list' && (trailingAst.children?.length ?? 0) === 0) {
            return callNode;
          }
          return Parser.appendTrailingBlock(callNode, trailingAst);
        },
        BareCallStmt_block: (callee, trailingBlock) => {
          const callNode: SurfaceNode = {
            kind: 'call',
            value: '',
            left: callee.ast(),
            children: [],
          };
          return Parser.appendTrailingBlock(callNode, trailingBlock.ast());
        },
        BareCallee: (head, tails) => tails.children.reduce((receiver, tail) => ({
          kind: 'access',
          value: tail.ast().value,
          left: receiver,
        }), head.ast()),
        BareCalleeTail: (_dot, name) => ({
          kind: 'access',
          value: name.sourceString,
        }),
        PostExp_const_access: (left, _sep, property) => ({
          kind: 'access',
          value: property.sourceString,
          left: left.ast(),
          target: 'const',
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
        ClassSuper: (_lt, name) => ({
          kind: 'class_super',
          value: name.sourceString,
        }),
        ClassBody: (members) => ({
          kind: 'class_body',
          value: '',
          children: members.children.flatMap((child) => {
            const ast = child.ast();
            return ast.kind === 'list' ? (ast.children ?? []) : [ast];
          }),
        }),
        ClassMember_meta: (member, _semi) => member.ast(),
        ClassMember_def: (member, _semi) => member.ast(),
        ClassMetaStmt: (_class, _shift, _self, _do, body, _end) => ({
          kind: 'list',
          value: '',
          children: Parser.listChildren(body.ast()),
        }),
        ClassMetaBody: (members) => ({
          kind: 'list',
          value: '',
          children: members.children.map((child) => child.ast()),
        }),
        ClassMetaMember: (member, _semi) => member.ast(),
        ClassMetaDefStmt_inline_params: (_def, name, _open, params, _close, _eq, body) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'class_def_stmt',
          value: name.sourceString,
          target: 'class',
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
            };
          })(),
        }),
        ClassMetaDefStmt_inline: (_def, name, _eq, body) => ({
          kind: 'class_def_stmt',
          value: name.sourceString,
          target: 'class',
          params: [],
          defaults: {},
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
        }),
        ClassMetaDefStmt_block: (_def, name, _open, params, _close, _do, body, _end) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'class_def_stmt',
          value: name.sourceString,
          target: 'class',
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: [{ kind: 'block_expr', value: '', children: Parser.listChildren(body.ast()) }],
            };
          })(),
        }),
        ClassDefStmt_class_inline_params: (_def, _self, _dot, name, _open, params, _close, _eq, body) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'class_def_stmt',
          value: name.sourceString,
          target: 'class',
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
            };
          })(),
        }),
        ClassDefStmt_class_inline: (_def, _self, _dot, name, _eq, body) => ({
          kind: 'class_def_stmt',
          value: name.sourceString,
          target: 'class',
          params: [],
          defaults: {},
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
        }),
        ClassDefStmt_class: (_def, _self, _dot, name, _open, params, _close, _do, body, _end) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'class_def_stmt',
          value: name.sourceString,
          target: 'class',
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: [{ kind: 'block_expr', value: '', children: Parser.listChildren(body.ast()) }],
            };
          })(),
        }),
        ClassDefStmt_instance_inline_params: (_def, name, _open, params, _close, _eq, body) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'def_stmt',
          value: name.sourceString,
          target: 'instance',
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
            };
          })(),
        }),
        ClassDefStmt_instance_inline: (_def, name, _eq, body) => ({
          kind: 'def_stmt',
          value: name.sourceString,
          target: 'instance',
          params: [],
          defaults: {},
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
        }),
        ClassDefStmt_instance: (_def, name, _open, params, _close, _do, body, _end) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'def_stmt',
          value: name.sourceString,
          target: 'instance',
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: [{ kind: 'block_expr', value: '', children: Parser.listChildren(body.ast()) }],
            };
          })(),
        }),
        DefStmt_inline_params: (_def, name, _open, params, _close, _eq, body) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'def_stmt',
          value: name.sourceString,
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
            };
          })(),
        }),
        DefStmt_inline: (_def, name, _eq, body) => ({
          kind: 'def_stmt',
          value: name.sourceString,
          params: [],
          defaults: {},
          children: [{ kind: 'block_expr', value: '', children: [body.ast()] }],
        }),
        DefStmt_block: (_def, name, _open, params, _close, _do, body, _end) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'def_stmt',
          value: name.sourceString,
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: [{ kind: 'block_expr', value: '', children: Parser.listChildren(body.ast()) }],
            };
          })(),
        }),
        LetStmt: (_let, name, _eq, expr) => ({
          kind: 'let_stmt',
          value: name.sourceString,
          left: expr.ast(),
        }),
        RequireStmt_bare: (_require, target) => ({
          kind: 'require_stmt',
          value: '',
          left: target.ast(),
        }),
        RequireStmt_paren: (_require, _open, target, _close) => ({
          kind: 'require_stmt',
          value: '',
          left: target.ast(),
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
        CondExp_ternary: (condition, _question, onTrue, _colon, onFalse) => ({
          kind: 'ternary_expr',
          value: '',
          left: condition.ast(),
          children: [
            { kind: 'block_expr', value: '', children: [onTrue.ast()] },
            { kind: 'block_expr', value: '', children: [onFalse.ast()] },
          ],
        }),
        PriExp_block: (_do, body, _end) => ({
          kind: 'block_expr',
          value: '',
          children: Parser.listChildren(body.ast()),
        }),
        PriExp_require_bare: (_require, target) => ({
          kind: 'require_stmt',
          value: '',
          left: target.ast(),
        }),
        PriExp_require: (_require, _open, target, _close) => ({
          kind: 'require_stmt',
          value: '',
          left: target.ast(),
        }),
        PriExp_super: (_super, _open, args, _close) => ({
          kind: 'super',
          value: '',
          children: Parser.listChildren(args.ast()),
        }),
        PriExp_lambda: (_arrow, _open, params, _close, _lbrace, body, _rbrace) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'lambda_expr',
          value: '<lambda>',
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: [{ kind: 'block_expr', value: '', children: Parser.listChildren(body.ast()) }],
            };
          })(),
        }),
        OrExp_or: (left, _op, right) => ({ kind: 'or', value: '', left: left.ast(), right: right.ast() }),
        AndExp_and: (left, _op, right) => ({ kind: 'and', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_eq: (left, _op, right) => ({ kind: 'eq', value: '', left: left.ast(), right: right.ast() }),
        CmpExp_semanticEq: (left, _op, right) => ({ kind: 'semantic_eq', value: '', left: left.ast(), right: right.ast() }),
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
        PostExp_call: (callee, _open, args, _close, trailingBlock) => {
          const callNode: SurfaceNode = {
            kind: 'call',
            value: '',
            left: callee.ast(),
            children: Parser.listChildren(args.ast()),
          };
          const trailingAst = trailingBlock.ast();
          if (trailingAst.kind === 'list' && (trailingAst.children?.length ?? 0) === 0) {
            return callNode;
          }
          return Parser.appendTrailingBlock(callNode, trailingAst);
        },
        PriExp_paren: (_open, exp, _close) => exp.ast(),
        PriExp_yield: (_yield, _open, args, _close) => ({
          kind: 'yield',
          value: '',
          children: Parser.listChildren(args.ast()),
        }),
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
        symbol: (_colon, name) => ({
          kind: 'symbol',
          value: name.sourceString,
        }),
        CallArgs: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        TrailingBlock: (_do, params, body, _end) => ({
          ...(() => {
            const signature = Parser.paramSignature(params.ast());
            return {
          kind: 'block_expr',
          value: '',
          params: signature.params,
          restParam: signature.restParam,
          defaults: signature.defaults,
          children: Parser.listChildren(body.ast()),
            };
          })(),
        }),
        BlockParams: (_open, params, _close) => params.ast(),
        BareCallArgs: (first, _seps, rest) => ({
          kind: 'list',
          value: '',
          children: [first.ast(), ...rest.children.map((child) => child.ast())],
        }),
        BareArg: (arg) => arg.ast(),
        BareArray: (_open, items, _close) => ({
          kind: 'array',
          value: '',
          children: Parser.listChildren(items.ast()),
        }),
        BareHash: (_open, entries, _close) => ({
          kind: 'hash',
          value: '',
          children: Parser.listChildren(entries.ast()),
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
        Param_default: (name, _eq, value) => ({
          kind: 'pair',
          value: name.sourceString,
          left: value.ast(),
        }),
        Param_rest: (_star, name) => ({
          kind: 'string',
          value: name.sourceString,
          target: 'rest_param',
        }),
        Param_plain: (name) => ({
          kind: 'ident',
          value: name.sourceString,
        }),
        HashEntry_pair: (key, _colon, value) => ({ kind: 'pair', value: key.sourceString, left: value.ast() }),
        HashEntry_shorthand: (key) => ({ kind: 'pair', value: key.sourceString, left: { kind: 'ident', value: key.sourceString } }),
        dstring: (_open, parts, _close) => {
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
        sstring: (_open, parts, _close) => ({
          kind: 'string',
          value: Parser.listChildren(parts.ast()).map((child) => child.value).join(''),
        }),
        hstring: (_open, parts, _close) => {
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
        sstringPart_text: (text) => text.ast(),
        sstringPart_escape: (_slash, escape) => escape.ast(),
        hstringPart_interp: (interpolation) => interpolation.ast(),
        hstringPart_text: (text) => text.ast(),
        hstringPart_escape: (_slash, escape) => escape.ast(),
        interpolation: (_open, expr, _close) => expr.ast(),
        stringText_plain: (char) => ({ kind: 'string', value: char.sourceString }),
        stringText_hash: (hash) => ({ kind: 'string', value: hash.sourceString }),
        sstringText: (char) => ({ kind: 'string', value: char.sourceString }),
        hstringText_plain: (char) => ({ kind: 'string', value: char.sourceString }),
        hstringText_hash: (hash) => ({ kind: 'string', value: hash.sourceString }),
        escape_quote: (_quote) => ({ kind: 'string', value: '"' }),
        escape_slash: (_slash) => ({ kind: 'string', value: "\\" }),
        escape_newline: (_newline) => ({ kind: 'string', value: "\n" }),
        escape_tab: (_tab) => ({ kind: 'string', value: "\t" }),
        sescape_quote: (_quote) => ({ kind: 'string', value: "'" }),
        sescape_slash: (_slash) => ({ kind: 'string', value: "\\" }),
        sescape_newline: (_newline) => ({ kind: 'string', value: "\n" }),
        sescape_tab: (_tab) => ({ kind: 'string', value: "\t" }),
        boolean_true: (_value) => ({ kind: 'bool', value: 'true' }),
        boolean_false: (_value) => ({ kind: 'bool', value: 'false' }),
        self: (_value) => ({ kind: 'ident', value: 'self' }),
        ivar: (_at, name) => ({ kind: 'ivar', value: name.sourceString }),
        number_whole: (digits) => ({ kind: 'number', value: digits.sourceString }),
        number_fract: (whole, _dot, fraction) => ({
          kind: 'number',
          value: `${whole.sourceString}.${fraction.sourceString}`,
        }),
        ident: (_fst, chars) => ({ kind: 'ident', value: _fst.sourceString + chars.sourceString }),
      });

      const matchResult = grammar.match(this.normalizeInput(input));
      if (matchResult.succeeded()) {
        return semantics(matchResult).ast();
      }
      throw new Error("Parse error: " + matchResult.message);
    }

    static parse(input: string): CoreNode {
      return Lowerer.lower(this.parseSurface(input));
    }
  }
