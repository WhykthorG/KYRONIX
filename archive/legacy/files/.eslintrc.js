/**
 * .eslintrc.js
 * Configuração ESLint focada em corrigir erros de sintaxe comuns.
 * Todas as regras aqui têm suporte a --fix automático.
 */

module.exports = {
  env: {
    browser: true,
    es2022: true,
    node: true,
  },

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },

  plugins: ["react"],

  settings: {
    react: { version: "detect" },
  },

  rules: {
    // ─── Ponto-e-vírgula ─────────────────────────────────────────────────
    semi: ["error", "always"],                   // garante ";" no fim
    "no-extra-semi": "error",                    // remove ";;" extras

    // ─── Vírgulas ────────────────────────────────────────────────────────
    "comma-dangle": ["error", "never"],          // remove trailing commas
    "comma-spacing": ["error", { before: false, after: true }],

    // ─── Parênteses e chaves ─────────────────────────────────────────────
    "no-extra-parens": ["error", "functions"],   // remove parênteses desnecessários
    curly: ["error", "all"],                     // exige {} em todos os blocos

    // ─── Aspas ───────────────────────────────────────────────────────────
    quotes: ["error", "double", { avoidEscape: true }],

    // ─── Espaçamento ─────────────────────────────────────────────────────
    "space-before-blocks": "error",
    "keyword-spacing": ["error", { before: true, after: true }],
    "space-infix-ops": "error",                  // espaço ao redor de operadores
    "space-in-parens": ["error", "never"],
    "object-curly-spacing": ["error", "always"],
    "array-bracket-spacing": ["error", "never"],
    "key-spacing": ["error", { beforeColon: false, afterColon: true }],

    // ─── Operadores ───────────────────────────────────────────────────────
    eqeqeq: ["error", "always"],                 // força === em vez de ==
    "no-compare-neg-zero": "error",
    "no-unsafe-negation": "error",

    // ─── Variáveis e declarações ─────────────────────────────────────────
    "no-var": "error",                           // const/let em vez de var
    "prefer-const": ["error", { destructuring: "all" }],
    "no-unused-vars": "warn",
    "no-undef": "warn",

    // ─── Funções ─────────────────────────────────────────────────────────
    "arrow-spacing": ["error", { before: true, after: true }],
    "arrow-parens": ["error", "as-needed"],
    "no-confusing-arrow": "error",

    // ─── Imports ─────────────────────────────────────────────────────────
    "no-duplicate-imports": "error",

    // ─── Objetos e arrays ────────────────────────────────────────────────
    "dot-location": ["error", "property"],
    "no-extra-boolean-cast": "error",

    // ─── Template literals ────────────────────────────────────────────────
    "no-useless-concat": "error",
    "prefer-template": "error",                  // "a" + b  →  `a${b}`

    // ─── JSX ─────────────────────────────────────────────────────────────
    "react/jsx-curly-spacing": ["error", "never"],
    "react/jsx-equals-spacing": ["error", "never"],
    "react/jsx-tag-spacing": ["error", { beforeSelfClosing: "always" }],
    "react/self-closing-comp": "error",          // <br></br>  →  <br />
    "react/jsx-boolean-value": ["error", "never"],
    "react/jsx-no-duplicate-props": "error",

    // ─── Indentação e formatação ─────────────────────────────────────────
    indent: ["error", 2, { SwitchCase: 1 }],
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"],
    "no-multiple-empty-lines": ["error", { max: 2, maxEOF: 1 }],
  },
};
