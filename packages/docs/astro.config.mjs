import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"

export default defineConfig({
  site: "https://tonyblu331.github.io",
  base: "/threejs-debug-view",
  integrations: [
    starlight({
      title: "threejs-debug-view",
      description: "Batteries-included TSL debug views for Three.js WebGPU render pipelines.",
      logo: {
        src: "./src/assets/logo.svg",
        alt: "threejs-debug-view logo",
        replacesTitle: false,
      },
      favicon: "./src/assets/logo.svg",
      customCss: ["./src/styles/theme.css"],
      editLink: {
        baseUrl: "https://github.com/tonyblu331/threejs-debug-view/edit/master/packages/docs/",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/tonyblu331/threejs-debug-view",
        },
      ],
      sidebar: [
        {
          label: "Start Here",
          items: ["index", "guides/quick-start", "guides/batteries-included", "guides/headless-runtime", "guides/render-modes"],
        },
        {
          label: "Debug Views",
          items: [
            "guides/built-in-views",
            "guides/custom-debug-views",
            "guides/performance",
            "guides/shader-cost-heatmap",
            "guides/viewport-labels",
          ],
        },
        {
          label: "Reference",
          items: ["reference/api", "reference/changelog", "reference/deployment"],
        },
      ],
    }),
  ],
})
