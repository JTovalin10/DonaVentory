import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

function terminalLogger(): Plugin {
  return {
    name: 'terminal-logger',
    configureServer(server) {
      server.middlewares.use('/__log', (req, res) => {
        if (req.method !== 'POST') { res.end(); return; }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { method, url, requestBody, status, response } = JSON.parse(body);
            console.log(`\n\x1b[36m[API]\x1b[0m ${method} ${url}`);
            if (requestBody !== undefined) console.log('  \x1b[33mBody:\x1b[0m', JSON.stringify(requestBody, null, 2));
            console.log(`  \x1b[33mStatus:\x1b[0m ${status}`);
            if (response !== undefined) console.log('  \x1b[33mResponse:\x1b[0m', JSON.stringify(response, null, 2));
          } catch { /* ignore malformed log payloads */ }
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), terminalLogger()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
