import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
  build: {
    copyPublicDir: false,
    lib: {
      entry: {
        index: resolve(__dirname, "components/debug-views/index.ts"),
        r3f: resolve(__dirname, "components/debug-views/r3f.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "@react-three/drei",
        "@react-three/fiber",
        "leva",
        "react",
        "react/jsx-runtime",
        "three",
        "three/tsl",
        "three/webgpu",
      ],
      output: {
        entryFileNames: "[name].js",
        preserveModules: true,
        preserveModulesRoot: "components/debug-views",
      },
    },
    sourcemap: false,
  },
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
  },
})
