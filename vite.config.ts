import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-key-api',
      configureServer(server) {
        // Path to the key file in the root directory
        const keyFilePath = path.resolve(process.cwd(), 'donaventory.key');

        server.middlewares.use('/api/key', (req, res) => {
          if (req.method === 'GET') {
            // Read the key from the file
            let key = '';
            if (fs.existsSync(keyFilePath)) {
              key = fs.readFileSync(keyFilePath, 'utf-8').trim();
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ key }));
          } 
          
          else if (req.method === 'POST') {
            // Write the key to the file
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const { key } = JSON.parse(body);
                fs.writeFileSync(keyFilePath, key || '');
                res.statusCode = 200;
                res.end(JSON.stringify({ message: 'Success' }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to write key' }));
              }
            });
          }
        });
      }
    }
  ],
});
