import { defineConfig } from 'vite';

// base 使用相对路径，打包后的 dist 可以直接部署到 GitHub Pages 或任意静态服务器
export default defineConfig({
  base: './',
});
