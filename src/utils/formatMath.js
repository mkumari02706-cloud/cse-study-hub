/**
 * Lightweight mathematical and LaTeX formatter for CSE Study Hub.
 * Converts LaTeX math expressions (like \frac{a}{b}, K_n, ^{...}, _{...}, symbols)
 * into clean readable HTML (<sub>, <sup>, fractions, Unicode) and strips raw $ delimiters.
 */

function wrapIfNeeded(expr) {
  const trimmed = (expr || '').trim();
  if (!trimmed) return '';
  let depth = 0;
  let hasTopLevelPlusMinus = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && (ch === '+' || ch === '-')) {
      hasTopLevelPlusMinus = true;
      break;
    }
  }
  return hasTopLevelPlusMinus ? `(${trimmed})` : trimmed;
}

function cleanMathSnippet(math) {
  if (!math || typeof math !== 'string') return '';
  let m = math;

  // Fractions: \frac{num}{den}
  while (/\\frac\{([^{}]+)\}\{([^{}]+)\}/.test(m)) {
    m = m.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, num, den) => {
      const cleanNum = wrapIfNeeded(num);
      const cleanDen = wrapIfNeeded(den);
      return `${cleanNum}/${cleanDen}`;
    });
  }

  // Common LaTeX mathematical, logical, and set operators
  const symbolMap = [
    [/\\leq?\b/g, '≤'],
    [/\\geq?\b/g, '≥'],
    [/\\neq?\b/g, '≠'],
    [/\\in\b/g, '∈'],
    [/\\notin\b/g, '∉'],
    [/\\subset\b/g, '⊂'],
    [/\\subseteq\b/g, '⊆'],
    [/\\forall\b/g, '∀'],
    [/\\exists\b/g, '∃'],
    [/\\rightarrow\b|\\to\b/g, '→'],
    [/\\leftarrow\b/g, '←'],
    [/\\leftrightarrow\b/g, '↔'],
    [/\\Rightarrow\b|\\implies\b/g, '⇒'],
    [/\\Leftarrow\b/g, '⇐'],
    [/\\Leftrightarrow\b|\\iff\b/g, '⇔'],
    [/\\land\b|\\wedge\b/g, '∧'],
    [/\\lor\b|\\vee\b/g, '∨'],
    [/\\neg\b|\\sim\b/g, '¬'],
    [/\\times\b/g, '×'],
    [/\\div\b/g, '÷'],
    [/\\pm\b/g, '±'],
    [/\\cdot\b/g, '·'],
    [/\\cap\b/g, '∩'],
    [/\\cup\b/g, '∪'],
    [/\\emptyset\b|\\varnothing\b/g, '∅'],
    [/\\infty\b/g, '∞'],
    [/\\sum\b/g, '∑'],
    [/\\prod\b/g, '∏'],
    [/\\sqrt\{([^{}]+)\}/g, '√($1)'],
    [/\\sqrt\b/g, '√'],
    [/\\alpha\b/g, 'α'],
    [/\\beta\b/g, 'β'],
    [/\\gamma\b/g, 'γ'],
    [/\\delta\b/g, 'δ'],
    [/\\theta\b/g, 'θ'],
    [/\\lambda\b/g, 'λ'],
    [/\\pi\b/g, 'π'],
    [/\\sigma\b/g, 'σ'],
    [/\\omega\b/g, 'ω'],
    [/\\Delta\b/g, 'Δ'],
    [/\\Sigma\b/g, 'Σ'],
    [/\\Omega\b/g, 'Ω'],
    [/\\mathbb\{R\}/g, 'ℝ'],
    [/\\mathbb\{Z\}/g, 'ℤ'],
    [/\\mathbb\{N\}/g, 'ℕ'],
    [/\\mathbb\{Q\}/g, 'ℚ'],
    [/\\text\{([^{}]+)\}/g, '$1'],
    [/\\mathrm\{([^{}]+)\}/g, '$1'],
    [/\\mathbf\{([^{}]+)\}/g, '<b>$1</b>'],
    [/\\left\(/g, '('],
    [/\\right\)/g, ')'],
    [/\\left\[/g, '['],
    [/\\right\]/g, ']'],
    [/\\left\\{/g, '{'],
    [/\\right\\}/g, '}'],
    [/\\\{/g, '{'],
    [/\\\}/g, '}']
  ];

  for (const [re, sym] of symbolMap) {
    m = m.replace(re, sym);
  }

  // Subscripts: _{...} or _n
  m = m.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
  m = m.replace(/_([a-zA-Z0-9\u0370-\u03ff])/g, '<sub>$1</sub>');

  // Superscripts: ^{...} or ^n
  m = m.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
  m = m.replace(/\^([a-zA-Z0-9+-])/g, '<sup>$1</sup>');

  return m.trim();
}

function formatMath(text) {
  if (!text || typeof text !== 'string') return text || '';

  let out = text;

  // 1. Process block math $$...$$
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => cleanMathSnippet(math));

  // 2. Process inline math $...$
  out = out.replace(/\$([^\$\n\r]+?)\$/g, (_match, math) => cleanMathSnippet(math));

  // 3. Fallback for raw LaTeX commands remaining without $
  if (/\\(frac|in|subset|subseteq|forall|exists|le|ge|ne|to|land|lor|neg|sqrt|times|alpha|beta|gamma|theta|lambda|pi|sigma|omega)/.test(out)) {
    out = cleanMathSnippet(out);
  }

  // 4. Strip any residual unparsed single dollar signs wrapping math terms (e.g. $K_n$, $1$, $(n-1)$)
  out = out.replace(/\$([^$\n\r]+?)\$/g, '$1');

  return out;
}

/**
 * Recursively cleans math LaTeX syntax across all strings in an object or array.
 */
function cleanLatexMathObject(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') return formatMath(val);
  if (Array.isArray(val)) return val.map(cleanLatexMathObject);
  if (typeof val === 'object') {
    const res = {};
    for (const key of Object.keys(val)) {
      res[key] = cleanLatexMathObject(val[key]);
    }
    return res;
  }
  return val;
}

module.exports = {
  formatMath,
  cleanMathSnippet,
  cleanLatexMathObject
};
