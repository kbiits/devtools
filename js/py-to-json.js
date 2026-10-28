DevTools.PyToJson = (function() {
  class PyParseError extends Error {
    constructor(message, offset) {
      super(message);
      this.offset = offset;
      this.name = 'PyParseError';
    }
  }

  function tokenize(input) {
    const tokens = [];
    let i = 0;

    while (i < input.length) {
      const c = input[i];

      if (/\s/.test(c)) {
        i++;
        continue;
      }

      if (c === '{') {
        tokens.push({ type: 'LBRACE', pos: i });
        i++;
      } else if (c === '}') {
        tokens.push({ type: 'RBRACE', pos: i });
        i++;
      } else if (c === '[') {
        tokens.push({ type: 'LBRACKET', pos: i });
        i++;
      } else if (c === ']') {
        tokens.push({ type: 'RBRACKET', pos: i });
        i++;
      } else if (c === '(') {
        tokens.push({ type: 'LPAREN', pos: i });
        i++;
      } else if (c === ')') {
        tokens.push({ type: 'RPAREN', pos: i });
        i++;
      } else if (c === ',') {
        tokens.push({ type: 'COMMA', pos: i });
        i++;
      } else if (c === ':') {
        tokens.push({ type: 'COLON', pos: i });
        i++;
      } else if (c === '"' || c === "'") {
        const quote = c;
        const start = i;
        i++;
        let str = '';

        while (i < input.length && input[i] !== quote) {
          if (input[i] === '\\' && i + 1 < input.length) {
            i++;
            const escaped = input[i];
            switch (escaped) {
              case 'n': str += '\n'; break;
              case 't': str += '\t'; break;
              case 'r': str += '\r'; break;
              case 'b': str += '\b'; break;
              case 'f': str += '\f'; break;
              case '0': str += '\0'; break;
              case '\\': str += '\\'; break;
              case '"': str += '"'; break;
              case "'": str += "'"; break;
              case 'x':
                if (i + 2 < input.length) {
                  const hex = input.slice(i + 1, i + 3);
                  if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                    str += String.fromCharCode(parseInt(hex, 16));
                    i += 2;
                  } else {
                    str += escaped;
                  }
                } else {
                  str += escaped;
                }
                break;
              case 'u':
                if (i + 4 < input.length) {
                  const hex = input.slice(i + 1, i + 5);
                  if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                    str += String.fromCharCode(parseInt(hex, 16));
                    i += 4;
                  } else {
                    str += escaped;
                  }
                } else {
                  str += escaped;
                }
                break;
              default:
                str += escaped;
            }
            i++;
          } else {
            str += input[i];
            i++;
          }
        }

        if (i >= input.length) {
          throw new PyParseError('Unterminated string literal', start);
        }

        i++;
        tokens.push({ type: 'STRING', value: str, pos: start });
      } else if (/\d/.test(c) || (c === '-' && i + 1 < input.length && /\d/.test(input[i + 1]))) {
        const start = i;
        let numStr = '';

        if (c === '-') {
          numStr += '-';
          i++;
        }

        while (i < input.length && /\d/.test(input[i])) {
          numStr += input[i];
          i++;
        }

        if (i < input.length && input[i] === '.') {
          numStr += '.';
          i++;
          while (i < input.length && /\d/.test(input[i])) {
            numStr += input[i];
            i++;
          }
        }

        if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
          numStr += input[i];
          i++;
          if (i < input.length && (input[i] === '+' || input[i] === '-')) {
            numStr += input[i];
            i++;
          }
          while (i < input.length && /\d/.test(input[i])) {
            numStr += input[i];
            i++;
          }
        }

        const num = parseFloat(numStr);
        tokens.push({ type: 'NUMBER', value: num, pos: start });
      } else if (/[a-zA-Z_]/.test(c)) {
        const start = i;
        let name = '';
        while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
          name += input[i];
          i++;
        }
        tokens.push({ type: 'NAME', value: name, pos: start });
      } else {
        throw new PyParseError(`Unexpected character '${c}'`, i);
      }
    }

    tokens.push({ type: 'EOF', pos: input.length });
    return tokens;
  }

  function parse(input) {
    const tokens = tokenize(input);
    let pos = 0;

    function peek() {
      return tokens[pos];
    }

    function advance() {
      return tokens[pos++];
    }

    function expect(type) {
      const token = peek();
      if (token.type !== type) {
        throw new PyParseError(`Expected ${type}, got ${token.type}`, token.pos);
      }
      return advance();
    }

    function parseValue() {
      const token = peek();

      if (token.type === 'LBRACE') {
        return parseDict();
      } else if (token.type === 'LBRACKET') {
        return parseList();
      } else if (token.type === 'LPAREN') {
        return parseTuple();
      } else if (token.type === 'STRING') {
        advance();
        return token.value;
      } else if (token.type === 'NUMBER') {
        advance();
        return token.value;
      } else if (token.type === 'NAME') {
        advance();
        if (token.value === 'True') return true;
        if (token.value === 'False') return false;
        if (token.value === 'None') return null;
        throw new PyParseError(`Unexpected identifier '${token.value}' — only True/False/None are allowed as bare names`, token.pos);
      } else {
        throw new PyParseError(`Unexpected token: ${token.type}`, token.pos);
      }
    }

    function parseDict() {
      const obj = {};
      expect('LBRACE');

      if (peek().type === 'RBRACE') {
        advance();
        return obj;
      }

      while (true) {
        if (peek().type === 'STRING') {
          const keyToken = advance();
          const key = keyToken.value;
          expect('COLON');
          const value = parseValue();
          obj[key] = value;
        } else {
          throw new PyParseError(`Dict keys must be strings, got ${peek().type}`, peek().pos);
        }

        if (peek().type === 'COMMA') {
          advance();
          if (peek().type === 'RBRACE') {
            advance();
            return obj;
          }
        } else if (peek().type === 'RBRACE') {
          advance();
          return obj;
        } else {
          throw new PyParseError(`Expected , or } in dict, got ${peek().type}`, peek().pos);
        }
      }
    }

    function parseList() {
      const arr = [];
      expect('LBRACKET');

      if (peek().type === 'RBRACKET') {
        advance();
        return arr;
      }

      while (true) {
        arr.push(parseValue());

        if (peek().type === 'COMMA') {
          advance();
          if (peek().type === 'RBRACKET') {
            advance();
            return arr;
          }
        } else if (peek().type === 'RBRACKET') {
          advance();
          return arr;
        } else {
          throw new PyParseError(`Expected , or ] in list, got ${peek().type}`, peek().pos);
        }
      }
    }

    function parseTuple() {
      const arr = [];
      expect('LPAREN');

      if (peek().type === 'RPAREN') {
        advance();
        return arr;
      }

      arr.push(parseValue());

      while (peek().type === 'COMMA') {
        advance();
        if (peek().type === 'RPAREN') {
          advance();
          return arr;
        }
        arr.push(parseValue());
      }

      expect('RPAREN');
      return arr;
    }

    const value = parseValue();
    if (peek().type !== 'EOF') {
      throw new PyParseError(`Unexpected trailing input after value`, peek().pos);
    }
    return value;
  }

  function convertFromInput() {
    const input = document.getElementById('pytojson-input').value;
    const outputBox = document.getElementById('pytojson-output');
    const errorBox = document.getElementById('pytojson-error');

    if (!input.trim()) {
      outputBox.value = '';
      errorBox.classList.add('hidden');
      return;
    }

    const result = DevTools.PyToJson.convert(input);

    if (!result.ok) {
      let errorMsg = result.message;
      if (result.line !== null && result.column !== null) {
        errorMsg = `Parse error at line ${result.line}, column ${result.column}: ${errorMsg}`;
      } else {
        errorMsg = `Parse error: ${errorMsg}`;
      }
      errorBox.textContent = errorMsg;
      errorBox.classList.remove('hidden');
      outputBox.value = '';
      return;
    }

    errorBox.classList.add('hidden');
    outputBox.value = JSON.stringify(result.value, null, 2);
  }

  return {
    convert(input) {
      try {
        const value = parse(input);
        return { ok: true, value };
      } catch (e) {
        if (e instanceof PyParseError) {
          const result = DevTools.offsetToLineCol(input, e.offset);
          return {
            ok: false,
            message: e.message,
            line: result.line,
            column: result.column
          };
        }
        return { ok: false, message: e.message, line: null, column: null };
      }
    },

    init() {
      const input = document.getElementById('pytojson-input');
      const debouncedConvert = DevTools.debounce(convertFromInput, 300);
      input.addEventListener('input', debouncedConvert);

      const copyBtn = document.getElementById('btn-copy-py-output');
      copyBtn.addEventListener('click', () => {
        const output = document.getElementById('pytojson-output').value;
        DevTools.copyToClipboard(output).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        });
      });
    }
  };
})();
