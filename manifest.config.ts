import type { ManifestV3Export } from "@crxjs/vite-plugin"

export const extensionManifest: ManifestV3Export = {
  manifest_version: 3,
  name: "Wiki Mermaid Preview",
  version: "0.1.1",
  description: "Render Mermaid previews below code blocks on authorized sites.",
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png"
  },
  permissions: ["storage", "scripting"],
  optional_host_permissions: ["http://*/*", "https://*/*"],
  background: {
    service_worker: "src/background/main.ts",
    type: "module"
  },
  options_page: "options.html"
}
