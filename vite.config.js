
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    laravel({
      input: ["resources/css/app.css", "resources/js/main.tsx"],
      refresh: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "resources/js"),
    },
  },
  server: {
    watch: {
      ignored: ["**/storage/framework/views/**"],
    },
  },
}); 