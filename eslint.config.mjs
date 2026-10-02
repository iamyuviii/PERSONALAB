import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
export default [
  { ignores: [".next/**", ".test-build/**", "node_modules/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
