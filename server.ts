import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import app from './server/app';

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development, or static file serving for production
  if (process.env.NODE_ENV !== 'production') {
    console.log('Booting development environment with on-the-fly Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Booting production environment serving statically compiled assets...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Netfyer professional gateway running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Fatal server boot failure:', error);
  process.exit(1);
});
