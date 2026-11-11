// Reads the subset of YAML a Spec Kit manifest needs - block mappings, block
// sequences, quoted and plain scalars, comments - and refuses everything
// else, by line, rather than guess at it. Spec Kit reads extension.yml with
// PyYAML's safe_load; a value this reads differently from PyYAML would be a
// manifest validated here that Spec Kit reads another way, so where YAML 1.1
// would turn a plain value into something other than a string (a date, an
// octal number, `yes`), the value is refused or read as PyYAML reads it.

export class YamlSubsetError extends Error {
  constructor(line, message) {
    super(`line ${line}: ${message}`);
    this.line = line;
  }
}

const BOOLEANS = new Map(
  ['y', 'Y', 'yes', 'Yes', 'YES', 'true', 'True', 'TRUE', 'on', 'On', 'ON']
    .map((word) => [word, true])
    .concat(['n', 'N', 'no', 'No', 'NO', 'false', 'False', 'FALSE', 'off', 'Off', 'OFF'].map((word) => [word, false])),
);
const NULLS = new Set(['', '~', 'null', 'Null', 'NULL']);
const KEY = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

// The line with its comment taken off: a `#` at the start, or after a space,
// outside quotes.
const withoutComment = (text, line) => {
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote === '"') {
      if (char === '\\') i += 1;
      else if (char === '"') quote = null;
    } else if (quote === "'") {
      if (char === "'" && text[i + 1] === "'") i += 1;
      else if (char === "'") quote = null;
    } else if (char === '"' || char === "'") {
      if (i === 0 || /[\s:[{,-]/.test(text[i - 1])) quote = char;
    } else if (char === '#' && (i === 0 || /\s/.test(text[i - 1]))) {
      return text.slice(0, i).trimEnd();
    }
  }
  if (quote !== null) throw new YamlSubsetError(line, 'a quoted value does not close on its line');
  return text.trimEnd();
};

const ESCAPES = { '"': '"', '\\': '\\', '/': '/', n: '\n', t: '\t' };

export const scalar = (raw, line) => {
  if (raw.startsWith('"')) {
    if (raw.length < 2 || !raw.endsWith('"')) throw new YamlSubsetError(line, 'text follows a closing quote');
    let out = '';
    for (let i = 1; i < raw.length - 1; i += 1) {
      const char = raw[i];
      if (char === '"') throw new YamlSubsetError(line, 'a double quote inside a double-quoted value is not escaped');
      if (char !== '\\') {
        out += char;
        continue;
      }
      const next = raw[i + 1];
      if (!(next in ESCAPES)) throw new YamlSubsetError(line, `the escape \\${next} is not one this reader takes`);
      out += ESCAPES[next];
      i += 1;
    }
    return out;
  }
  if (raw.startsWith("'")) {
    if (raw.length < 2 || !raw.endsWith("'")) throw new YamlSubsetError(line, 'text follows a closing quote');
    const body = raw.slice(1, -1);
    if (/'(?!')/.test(body.replace(/''/g, ''))) throw new YamlSubsetError(line, "a single quote inside a single-quoted value is not doubled");
    return body.replace(/''/g, "'");
  }
  if (/^[[\]{}&*!|>%@`]/.test(raw)) throw new YamlSubsetError(line, `a value opening with ${raw[0]} is YAML this reader does not take; quote it`);
  if (raw.includes(': ') || raw.includes(' #') || raw.endsWith(':')) throw new YamlSubsetError(line, `the plain value ${raw} is ambiguous; quote it`);
  if (NULLS.has(raw)) return null;
  if (BOOLEANS.has(raw)) return BOOLEANS.get(raw);
  if (/^[-+]?(0|[1-9][0-9]*)$/.test(raw)) return Number(raw);
  if (/^[-+]?[0-9]*\.[0-9]+([eE][-+]?[0-9]+)?$/.test(raw) || /^[-+]?[0-9]+\.[0-9]*$/.test(raw)) return Number(raw);
  if (/^[-+]?0[0-9_]+$/.test(raw) || /^[-+]?0[xob]/.test(raw) || /^[-+]?[0-9][0-9_]*(:[0-5]?[0-9])+/.test(raw) || /^[-+]?\.(inf|Inf|INF|nan|NaN|NAN)$/.test(raw)) {
    throw new YamlSubsetError(line, `the plain value ${raw} is a number to YAML 1.1 in a form this reader does not take; quote it`);
  }
  if (/^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}/.test(raw)) throw new YamlSubsetError(line, `the plain value ${raw} is a date to YAML 1.1; quote it`);
  return raw;
};

export function parseYamlSubset(text) {
  if (text.includes('\r')) throw new YamlSubsetError(1, 'a line ends in CR; the file is LF');
  const lines = [];
  text.split('\n').forEach((raw, index) => {
    const line = index + 1;
    if (/\t/.test(raw.match(/^\s*/)[0])) throw new YamlSubsetError(line, 'a tab indents the line');
    if (raw.trim() === '---' || raw.trim() === '...') {
      if (lines.length > 0 || raw.trim() === '...') throw new YamlSubsetError(line, 'a second document, or a document end, is YAML this reader does not take');
      return;
    }
    const content = withoutComment(raw, line);
    if (content.trim() === '') return;
    const indent = content.length - content.trimStart().length;
    lines.push({ line, indent, text: content.trimStart() });
  });

  let at = 0;

  const parseNode = (indent) => {
    const first = lines[at];
    if (first.text === '-' || first.text.startsWith('- ')) return parseSequence(indent);
    return parseMapping(indent);
  };

  const parseSequence = (indent) => {
    const items = [];
    while (at < lines.length && lines[at].indent === indent && (lines[at].text === '-' || lines[at].text.startsWith('- '))) {
      const { line, text } = lines[at];
      const rest = text === '-' ? '' : text.slice(2).trimStart();
      if (rest === '') {
        at += 1;
        if (at >= lines.length || lines[at].indent <= indent) items.push(null);
        else items.push(parseNode(lines[at].indent));
      } else if (/^[A-Za-z0-9_][A-Za-z0-9_.-]*:( |$)/.test(rest)) {
        // A mapping that opens on the dash's line: read it at the column of
        // its first key.
        const column = indent + (text.length - rest.length);
        lines[at] = { line, indent: column, text: rest };
        items.push(parseMapping(column));
      } else {
        items.push(scalar(rest, line));
        at += 1;
      }
    }
    if (at < lines.length && lines[at].indent > indent) throw new YamlSubsetError(lines[at].line, 'the line is indented under a sequence item that cannot hold it');
    return items;
  };

  const parseMapping = (indent) => {
    const map = {};
    while (at < lines.length && lines[at].indent === indent) {
      const { line, text } = lines[at];
      if (text === '-' || text.startsWith('- ')) throw new YamlSubsetError(line, 'a sequence item stands among the keys of a mapping');
      const colon = text.indexOf(':');
      const key = colon > 0 ? text.slice(0, colon) : '';
      if (!KEY.test(key) || (text[colon + 1] !== undefined && text[colon + 1] !== ' ')) {
        throw new YamlSubsetError(line, 'the line is no `key: value` this reader takes; a key is a plain word');
      }
      if (Object.hasOwn(map, key)) throw new YamlSubsetError(line, `the key ${key} is given twice`);
      const rest = text.slice(colon + 1).trim();
      at += 1;
      if (rest !== '') {
        map[key] = scalar(rest, line);
      } else if (at < lines.length && lines[at].indent > indent) {
        map[key] = parseNode(lines[at].indent);
      } else if (at < lines.length && lines[at].indent === indent && (lines[at].text === '-' || lines[at].text.startsWith('- '))) {
        map[key] = parseSequence(indent);
      } else {
        map[key] = null;
      }
    }
    if (at < lines.length && lines[at].indent > indent) throw new YamlSubsetError(lines[at].line, 'the line is indented further than the key above it allows');
    return map;
  };

  if (lines.length === 0) return null;
  if (lines[0].indent !== 0) throw new YamlSubsetError(lines[0].line, 'the document does not open at column 0');
  const value = parseNode(0);
  if (at < lines.length) throw new YamlSubsetError(lines[at].line, 'the line is indented less than its block, and more than the one above');
  return value;
}
