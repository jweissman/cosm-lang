import { SurfaceNode, CoreNode, CoreNodeKind } from "../types";

  export class Lowerer {
    static lower(node: SurfaceNode): CoreNode {
      switch (node.kind) {
        case 'program':
          return {
            kind: 'program',
            value: '',
            children: this.lowerProgramChildren(node),
          };
        case 'statement_list':
          return { kind: 'block', value: '', children: this.lowerChildren(node) };
        case 'statement':
          if (!node.left) {
            throw new Error('Invalid surface AST: statement node must wrap a child');
          }
          return this.lower(node.left);
        case 'class_stmt':
          return {
            kind: 'class',
            value: node.value,
            left: node.left ? this.lower(node.left) : undefined,
            children: this.lowerChildren(node),
          };
        case 'def_stmt':
          return {
            kind: 'def',
            value: node.value,
            params: node.params ?? [],
            children: this.lowerChildren(node),
          };
        case 'class_def_stmt':
          return {
            kind: 'class_def',
            value: node.value,
            params: node.params ?? [],
            children: this.lowerChildren(node),
          };
        case 'let_stmt':
          return {
            kind: 'let',
            value: node.value,
            left: this.lowerRequired(node.left, 'let_stmt'),
          };
        case 'class_super':
          return {
            kind: 'ident',
            value: node.value,
          };
        case 'if_expr':
          return {
            kind: 'if',
            value: '',
            left: this.lowerRequired(node.left, 'if_expr'),
            children: this.lowerChildren(node),
          };
        case 'block_expr':
          return {
            kind: 'block',
            value: '',
            children: this.lowerChildren(node),
          };
        case 'lambda_expr':
          return {
            kind: 'lambda',
            value: '<lambda>',
            params: node.params ?? [],
            children: this.lowerChildren(node),
          };
        case 'number':
        case 'bool':
        case 'string':
        case 'ident':
        case 'ivar':
        case 'add':
        case 'subtract':
        case 'multiply':
        case 'divide':
        case 'pow':
        case 'pos':
        case 'neg':
        case 'not':
        case 'or':
        case 'and':
        case 'eq':
        case 'neq':
        case 'lt':
        case 'lte':
        case 'gt':
        case 'gte':
        case 'access':
        case 'call':
        case 'array':
        case 'hash':
        case 'pair':
          return {
            kind: node.kind as CoreNodeKind,
            value: node.value,
            params: node.params,
            left: node.left ? this.lower(node.left) : undefined,
            right: node.right ? this.lower(node.right) : undefined,
            children: node.children?.map((child) => this.lower(child)),
          };
        case 'list':
        case 'class_body':
          throw new Error('Invalid surface AST: list nodes must be lowered by their parent');
      }
    }

    private static lowerChildren(node: SurfaceNode): CoreNode[] {
      return (node.children ?? []).map((child) => this.lower(child));
    }

    private static lowerProgramChildren(node: SurfaceNode): CoreNode[] {
      const [statementList] = node.children ?? [];
      if (!statementList) {
        return [];
      }
      if (statementList.kind !== 'statement_list') {
        throw new Error('Invalid surface AST: program must contain a statement list');
      }
      return this.lowerChildren(statementList);
    }

    private static lowerRequired(node: SurfaceNode | undefined, kind: string): CoreNode {
      if (!node) {
        throw new Error(`Invalid surface AST: ${kind} is missing a required child`);
      }
      return this.lower(node);
    }
  }
