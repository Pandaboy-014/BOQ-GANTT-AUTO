import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Proxy API route to avoid CORS issues with Google Apps Script
  app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      console.log(`[Proxy] Requesting: ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
      });

      console.log(`[Proxy] Target responded with status: ${response.status}`);
      
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (!response.ok) {
        console.error(`[Proxy] Target API error: ${response.status}`, text.substring(0, 200));
        
        let errorMessage = `Target API returned ${response.status}`;
        if (response.status === 401 || response.status === 403 || text.includes('goog-login-button')) {
          errorMessage = "401 Unauthorized: กรุณาตั้งค่า Google Apps Script ให้ 'Who has access: Anyone'";
        }
        
        return res.status(response.status).json({ error: errorMessage, details: text.substring(0, 500) });
      }

      // Check if it's actually JSON even if content-type says otherwise, or if content-type is missing
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch (e) {
        console.error(`[Proxy] Failed to parse target response as JSON. Content-Type: ${contentType}`);
        
        if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
          return res.status(422).json({ 
            error: "ได้รับข้อมูลเป็น HTML แทนที่จะเป็น JSON. โปรดตรวจสอบว่าได้เผยแพร่ Google Apps Script แบบ 'Anyone' และ URL ถูกต้อง",
            details: text.substring(0, 200)
          });
        }
        
        return res.status(422).json({ 
          error: "ข้อมูลที่ได้รับจาก URL ไม่ใช่รูปแบบ JSON ที่ถูกต้อง",
          details: text.substring(0, 200)
        });
      }
    } catch (error: any) {
      console.error('[Proxy] Failure:', error);
      res.status(500).json({ error: `Proxy failure: ${error.message}` });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve Vite in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
