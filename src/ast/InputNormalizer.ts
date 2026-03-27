export class InputNormalizer {
  static normalize(input: string): string {
    let output = "";
    let lineBuffer = "";
    let inSingle = false;
    let inDouble = false;
    let inTripleDouble = false;
    let escaped = false;
    let inComment = false;

    const flushLine = (newline = "") => {
      const lineWithoutComment = inComment ? lineBuffer.replace(/#.*$/, "") : lineBuffer;
      output += lineBuffer;
      if (newline) {
        output += this.shouldInsertSemicolon(lineWithoutComment) ? `;${newline}` : newline;
      }
      lineBuffer = "";
      inComment = false;
    };

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];

      if (inComment) {
        if (char === "\n") {
          flushLine("\n");
        } else {
          lineBuffer += char;
        }
        continue;
      }

      if (inTripleDouble) {
        if (input.slice(index, index + 3) === "\"\"\"") {
          lineBuffer += "\"\"\"";
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
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (inSingle && char === "'") {
          inSingle = false;
        } else if (inDouble && char === "\"") {
          inDouble = false;
        }
        continue;
      }

      if (char === "#") {
        inComment = true;
        lineBuffer += char;
        continue;
      }
      if (char === "'") {
        inSingle = true;
        lineBuffer += char;
        continue;
      }
      if (input.slice(index, index + 3) === "\"\"\"") {
        inTripleDouble = true;
        lineBuffer += "\"\"\"";
        index += 2;
        continue;
      }
      if (char === "\"") {
        inDouble = true;
        lineBuffer += char;
        continue;
      }
      if (char === "\n") {
        flushLine("\n");
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
    if (trimmed.endsWith(";")) {
      return false;
    }
    if (/^class\b/.test(trimmed) && !/\bend\s*$/.test(trimmed)) {
      return false;
    }
    if (/^module\b/.test(trimmed) && !/\bend\s*$/.test(trimmed)) {
      return false;
    }
    if (/^def\b/.test(trimmed) && !/\bend\s*$/.test(trimmed)) {
      return false;
    }
    if (
      trimmed === "begin"
      || /^rescue\b/.test(trimmed)
      || trimmed === "do"
      || trimmed === "else"
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
}
