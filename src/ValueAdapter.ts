import { CosmValue } from "./types";

export class ValueAdapter {
  static cosmToJS(value: CosmValue): any {
    switch (value.type) {
      case 'number':
        return value.value;
      case 'bool':
        return value.value;
      case 'string':
        return value.value;
      case 'symbol':
        return { kind: 'symbol', name: value.name };
      case 'array':
        return value.items.map((item) => this.cosmToJS(item));
      case 'hash':
        return Object.fromEntries(
          Object.entries(value.entries).map(([key, entry]) => [key, this.cosmToJS(entry)]),
        );
      case 'class':
        return {
          kind: 'class',
          name: value.name,
          superclassName: value.superclassName,
          metaclassName: value.classRef?.name,
          slots: value.slots,
          methods: Object.keys(value.methods),
          classMethods: Object.keys((value.classRef && value.classRef !== value ? value.classRef.methods : value.classMethods)),
          className: (value.classRef ?? this.repository.classes.Class).name,
        };
      case 'object':
        return Object.fromEntries(
          Object.entries(value.fields).map(([key, entry]) => [key, this.cosmToJS(entry)]),
        );
      case 'function':
        return { kind: 'function', name: value.name };
      case 'method':
        return {
          kind: 'method',
          name: value.name,
          receiverType: value.receiver.type,
          receiverClassName: value.receiver.type === 'object' ? value.receiver.className : undefined,
        };
    }
  }

  static format(value: CosmValue): string {
    switch (value.type) {
      case 'number':
        return String(value.value);
      case 'bool':
        return String(value.value);
      case 'string':
        return JSON.stringify(value.value);
      case 'symbol':
        return `:${value.name}`;
      case 'array':
        return `[${value.items.map((item) => this.format(item)).join(', ')}]`;
      case 'hash':
        return `{ ${Object.entries(value.entries).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(', ')} }`;
      case 'function':
        return `<function ${value.name}>`;
      case 'method':
        return `<method ${value.name}>`;
      case 'class':
        return value.name;
      case 'object': {
        const entries = Object.entries(value.fields).map(([key, entry]) => `${key}: ${this.format(entry)}`).join(', ');
        if (value.className === 'Object') {
          return `{ ${entries} }`;
        }
        return entries.length > 0 ? `#<${value.className} ${entries}>` : `#<${value.className}>`;
      }
    }
  }
}

