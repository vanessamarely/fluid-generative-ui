// Parser JSON incremental para la salida en streaming del modelo.
//
// En lugar de esperar al final para hacer JSON.parse(), recorremos los tokens a medida
// que llegan (cada carácter se procesa UNA vez: O(n), no O(n²)) y emitimos eventos:
//   onField(key, value)              un campo de primer nivel quedó completo
//                                    → { "region": "samana" } en cuanto se cierra la comilla
//   onPartialString(key, text)       un string de primer nivel que se está escribiendo
//                                    → el título aparece letra por letra
//   onItem(key, i, obj, complete)    cada objeto de un array de primer nivel,
//                                    parcial mientras se escribe y completo al cerrarse

export interface StreamParserHandlers {
  onField?: (key: string, value: unknown) => void;
  onPartialString?: (key: string, text: string) => void;
  onItem?: (key: string, index: number, value: Record<string, unknown>, complete: boolean) => void;
}

export function createJsonStreamParser(h: StreamParserHandlers) {
  let text = '';
  let pos = 0;
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  let key = '';
  let lastString = '';
  let stringStart = -1;
  let expectingValue = false;
  let valueStart = -1;
  let itemStart = -1;
  let itemIndex = 0;

  const emitField = (raw: string) => {
    try {
      h.onField?.(key, JSON.parse(raw));
    } catch {
      /* valor inválido: lo ignoramos */
    }
  };

  function scan() {
    for (; pos < text.length; pos++) {
      const ch = text[pos];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') {
          inString = false;
          if (stack.length === 1) {
            if (valueStart === stringStart) {
              emitField(text.slice(valueStart, pos + 1));
              valueStart = -1;
            } else lastString = text.slice(stringStart + 1, pos);
          }
        }
        continue;
      }
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue;
      if (stack.length === 1 && expectingValue) {
        valueStart = pos;
        expectingValue = false;
      }
      switch (ch) {
        case '"':
          inString = true;
          stringStart = pos;
          break;
        case ':':
          if (stack.length === 1) {
            key = lastString;
            expectingValue = true;
          }
          break;
        case '{':
        case '[':
          if (stack.length === 2 && stack[1] === '[' && ch === '{') itemStart = pos;
          stack.push(ch);
          if (stack.length === 2 && ch === '[') itemIndex = 0;
          break;
        case '}':
        case ']':
          stack.pop();
          if (stack.length === 2 && ch === '}' && itemStart >= 0) {
            try {
              h.onItem?.(key, itemIndex, JSON.parse(text.slice(itemStart, pos + 1)), true);
            } catch {
              /* objeto inválido */
            }
            itemStart = -1;
            itemIndex++;
          } else if (stack.length === 1 && valueStart >= 0) {
            emitField(text.slice(valueStart, pos + 1));
            valueStart = -1;
          } else if (stack.length === 0 && valueStart >= 0) {
            emitField(text.slice(valueStart, pos)); // número/booleano al final del objeto raíz
            valueStart = -1;
          }
          break;
        case ',':
          if (stack.length === 1 && valueStart >= 0) {
            emitField(text.slice(valueStart, pos));
            valueStart = -1;
          }
          break;
      }
    }
  }

  return {
    push(chunk: string) {
      text += chunk;
      scan();
      // String de primer nivel a medio escribir → texto en vivo.
      if (inString && stack.length === 1 && valueStart === stringStart && valueStart >= 0) {
        h.onPartialString?.(key, unescapePartial(text.slice(stringStart + 1)));
      }
      // Objeto de un array a medio escribir → lo "reparamos" para pintar lo que ya llegó.
      if (itemStart >= 0) {
        const partial = parsePartialJson(text.slice(itemStart));
        if (partial && typeof partial === 'object') h.onItem?.(key, itemIndex, partial as Record<string, unknown>, false);
      }
    },
    get text() {
      return text;
    },
  };
}

function unescapePartial(raw: string): string {
  try {
    return JSON.parse('"' + raw.replace(/\\(u[0-9a-fA-F]{0,3})?$/, '') + '"');
  } catch {
    return raw;
  }
}

/**
 * Intenta parsear un prefijo de JSON cerrando strings/objetos/arrays abiertos.
 * `{"title":"Hola mun` → `{ title: "Hola mun" }`
 */
export function parsePartialJson(src: string): unknown {
  const closers: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of src) {
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') closers.push('}');
    else if (ch === '[') closers.push(']');
    else if (ch === '}' || ch === ']') closers.pop();
  }
  let base = src;
  if (inString) base = (escape ? base.slice(0, -1) : base) + '"';
  const tail = closers.reverse().join('');
  const candidates = [
    base,
    base.replace(/,\s*$/, ''),
    // clave colgando: {"a":1,"tit  → {"a":1
    base.replace(/,?\s*"[^"]*"\s*:?\s*$/, ''),
    // valor no-string a medias: {"n":12.  /  {"ok":tr
    base.replace(/,?\s*"[^"]*"\s*:\s*[^,{}[\]"]*$/, ''),
  ];
  for (const c of candidates) {
    try {
      return JSON.parse(c + tail);
    } catch {
      /* siguiente candidato */
    }
  }
  return null;
}
