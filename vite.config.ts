import { crx } from "@crxjs/vite-plugin"
import { defineConfig } from "vite"
import { extensionManifest } from "./manifest.config"

export default defineConfig({
  base: "./",
  plugins: [crx({ manifest: extensionManifest })]
})
