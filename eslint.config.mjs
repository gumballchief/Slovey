// Flat config (ESLint 9). Non-type-checked recommended rules keep the lint
// gate fast and dependency-light; typecheck already covers type-aware errors.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.min.js",
      "**/drizzle/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Correctness rules stay as errors (defaults). Cleanliness/opinion rules
      // are advisory warnings for this retrofit — typecheck is the strict gate,
      // and these shouldn't block a commit or trigger unrelated refactors.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-useless-assignment": "warn",
    },
  },
  {
    // Next.js app: register the Next + react-hooks plugins so their rules
    // (and the eslint-disable comments referencing them) resolve.
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      // Classic hooks baseline for an existing app: rules-of-hooks is a real
      // correctness gate; exhaustive-deps advises. The newer React-Compiler
      // rules (set-state-in-effect, immutability) are too aggressive to
      // retrofit and are left off.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
