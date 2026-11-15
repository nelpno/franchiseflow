/**
 * Guarda contra TELA BRANCA — roda separado do `npm run lint`.
 *
 * Por que existe: em `eslint.config.js` o bloco `rules:` SOBRESCREVE inteiro o
 * `rules` que veio de `pluginJs.configs.recommended`, entao `no-undef` fica
 * DESLIGADO. Um simbolo usado e nao importado (`safeErrorMessage`, `<Skeleton>`,
 * uma pagina removida do `pages.config.js` mas ainda citada no objeto PAGES)
 * compila, passa no lint, passa no build — e explode com `ReferenceError` no
 * navegador do franqueado, em tela branca. O Rollup trata o simbolo solto como
 * referencia global, nao como erro. Ja aconteceu duas vezes neste projeto
 * (29/05/2026 e 02/07/2026).
 *
 * Aqui NAO se liga estilo nem boa pratica: so as duas regras que pegam essa
 * classe de defeito, e sobre `src/` INTEIRO — inclusive `components/ui/`,
 * `App.jsx`, `main.jsx` e `pages.config.js`, que o lint normal ignora.
 *
 *   npm run lint:undef
 *
 * Medido em 07/09/2026: 0 ocorrencias em `src/` (risco latente, nao presente).
 * O teste do proprio guarda esta em `scripts/verifica-guarda-undef.mjs`.
 */
import globals from "globals";
import pluginReact from "eslint-plugin-react";
// registrado mas com as regras DESLIGADAS: varios arquivos tem
// `// eslint-disable-next-line react-hooks/exhaustive-deps` no meio do codigo, e o
// ESLint reprova o arquivo inteiro se a regra citada num disable nao existir.
import pluginReactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["src/**/*.{js,mjs,cjs,jsx}"],
    ignores: ["src/**/*.test.mjs"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    // as regras do react-hooks estao desligadas aqui, entao os
    // `eslint-disable-next-line react-hooks/exhaustive-deps` do codigo viram
    // "diretiva inutil". Sao legitimos no lint normal — nao poluir a saida desta guarda.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    settings: { react: { version: "detect" } },
    plugins: { react: pluginReact, "react-hooks": pluginReactHooks },
    rules: {
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "off",
      "no-undef": "error",
      "react/jsx-no-undef": "error",
      // marca o simbolo importado como "usado" quando ele so aparece em JSX,
      // senao nao ha como distinguir import morto de componente em uso.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
    },
  },
];
