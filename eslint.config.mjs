import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier/recommended";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  // Base configuration for all TypeScript files
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@llm-boost/db",
              message:
                "Direct database access is restricted to API/billing packages. Call the HTTP API or shared SDK instead.",
            },
          ],
          patterns: [
            {
              group: ["@llm-boost/db/*"],
              message:
                "Direct database access is restricted to API/billing packages. Call the HTTP API or shared SDK instead.",
            },
          ],
        },
      ],
    },
  },
  // React-specific configuration for apps/web
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": hooksPlugin,
    },
    settings: {
      react: {
        version: "19.0", // Explicitly set React version
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...hooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off", // Disable problematic rule
    },
  },
  {
    files: [
      "apps/api/**/*.{ts,tsx,js,jsx}",
      "apps/report-worker/**/*.{ts,tsx,js,jsx}",
      "apps/report-service/**/*.{ts,tsx,js,jsx}",
      "packages/billing/**/*.{ts,tsx,js,jsx}",
      "packages/db/**/*.{ts,tsx,js,jsx}",
      "packages/reports/**/*.{ts,tsx,js,jsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/target/**",
      "**/.turbo/**",
      "**/.wrangler/**",
      "**/pnpm-lock.yaml",
    ],
  },
);
