import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "src/generated/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Three.js/R3F: đối tượng scene, camera, material được cập nhật trực tiếp trong useFrame và effect
    // (đây là cách dùng chuẩn của API imperative). Không gán các giá trị đó trong lúc render.
    files: ["src/components/train/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
