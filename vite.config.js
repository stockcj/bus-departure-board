import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Runs the api/ Vercel functions inside the Vite dev server, so `npm run dev`
// alone serves the whole app. In production Vercel runs the same handlers.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      // Mounted on /api, so req.url here is e.g. "/departure?stopId=..."
      server.middlewares.use('/api', async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const route = url.pathname.replace(/^\/+/, '').replace(/\.js$/, '');

        if (!/^[\w-]+$/.test(route)) return next();

        // Minimal shims for the bits of the Vercel req/res the handlers use.
        req.query = Object.fromEntries(url.searchParams);
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (body) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
          return res;
        };

        try {
          // ssrLoadModule picks up edits to api/ without restarting the server.
          const { default: handler } = await server.ssrLoadModule(`/api/${route}.js`);
          await handler(req, res);
        } catch (err) {
          server.config.logger.error(`[dev-api] /api/${route} failed:\n${err.stack || err}`);
          if (!res.headersSent) {
            res.status(500).json({ error: `Dev API error in /api/${route}` });
          }
        }
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), devApi()],
});
