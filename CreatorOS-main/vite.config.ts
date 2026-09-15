import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function localApiPlugin(): Plugin {
  return {
    name: 'local-api-handler',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        try {
          const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
          const routePath = urlObj.pathname;

          const relativeFilePath = routePath.replace(/^\/api\//, '');
          const tsFilePath = path.resolve(__dirname, 'api', `${relativeFilePath}.ts`);

          if (!fs.existsSync(tsFilePath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'not_found', message: `API route ${routePath} not found` }));
            return;
          }

          const queryObj: Record<string, string> = {};
          urlObj.searchParams.forEach((val, key) => {
            queryObj[key] = val;
          });
          (req as any).query = queryObj;

          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
            let bodyData = '';
            req.on('data', chunk => { bodyData += chunk; });
            await new Promise((resolve) => req.on('end', resolve));
            if (bodyData) {
              try {
                (req as any).body = JSON.parse(bodyData);
              } catch {
                (req as any).body = bodyData;
              }
            }
          }

          (res as any).status = function (code: number) {
            res.statusCode = code;
            return res;
          };
          (res as any).json = function (data: any) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
          };

          const module = await server.ssrLoadModule(tsFilePath);
          const handler = module.default;

          if (typeof handler === 'function') {
            await handler(req, res);
          } else {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'invalid_handler', message: 'No default handler exported' }));
          }
        } catch (err: any) {
          console.error('[API Middleware Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'internal_error', message: err.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), localApiPlugin()],
    server: {
      port: 3000,
      open: false,
    },
  };
});
