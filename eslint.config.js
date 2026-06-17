import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "coverage/**",
      "**/.next/**",
      "**/dist/**",
      "**/node_modules/**",
      "fountlayer_project_docs.zip",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        console: "readonly",
        fetch: "readonly",
        Headers: "readonly",
        ReadableStream: "readonly",
        Response: "readonly",
        URL: "readonly",
        process: "readonly",
      },
    },
  },
);
