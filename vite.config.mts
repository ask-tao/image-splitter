import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { viteSingleFile } from 'vite-plugin-singlefile' // Import the plugin

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isSingleFileBuild = mode === 'single-file';

  return {
    base: './',
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
      isSingleFileBuild ? viteSingleFile() : undefined,
    ].filter(Boolean),
    build: {
      outDir: isSingleFileBuild ? 'dist-single' : 'dist', // Set output directory conditionally
      
    },
  }
})
