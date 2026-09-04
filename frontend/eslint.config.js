import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Flat config for the React app.
 *
 * The rule that earns its keep here is react-hooks/rules-of-hooks. Both
 * dashboards used to return a redirect above roughly twenty-five useState
 * calls, so a session expiring between renders changed the hook count and React
 * tore the component down instead of redirecting. That is invisible in review
 * and obvious to this rule.
 *
 * exhaustive-deps is a warning rather than an error: the existing effects
 * deliberately run once with an empty dep array in several places, and turning
 * those into build failures would mean either a large refactor or a scattering
 * of suppressions.
 */
export default [
  { ignores: ["dist/**", "dev-dist/**", "node_modules/**", "public/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "warn",
      // Without this, no-unused-vars does not count `<Icon />` as a use and
      // reports every imported component as dead — 380-odd false positives
      // across this codebase. The rest of eslint-plugin-react is left off;
      // this one rule is what makes no-unused-vars usable on JSX.
      "react/jsx-uses-vars": "error",
      // `catch (_) {}` is a deliberate, pervasive idiom here — a failed poll or
      // a private window throwing on localStorage must not break a render, and
      // the emptiness is the point. Everything else empty is still an error.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        caughtErrors: "none",
      }],
    },
  },
  {
    files: ["tests/**/*.{js,jsx}"],
    languageOptions: { globals: { ...globals.node } },
  },
];
