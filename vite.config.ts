import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync, cpSync, mkdirSync } from 'fs';

function copyExtensionFiles(): Plugin {
  return {
    name: 'copy-extension-files',
    writeBundle() {
      // Copy manifest with adjusted paths
      const manifest = JSON.parse(readFileSync('manifest.json', 'utf-8'));
      manifest.side_panel.default_path = 'src/panel/index.html';
      manifest.action.default_popup = 'src/popup/index.html';
      writeFileSync(resolve(__dirname, 'dist', 'manifest.json'), JSON.stringify(manifest, null, 2));

      // Copy icons
      mkdirSync(resolve(__dirname, 'dist', 'icons'), { recursive: true });
      cpSync(resolve(__dirname, 'public', 'icons'), resolve(__dirname, 'dist', 'icons'), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  build: {
    outDir: 'dist',
    emptyDirOnBuild: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'src/panel/index.html'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'src/background/service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
