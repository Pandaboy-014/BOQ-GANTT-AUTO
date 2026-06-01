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
    let targetUrl = (req.query.url as string || '').trim();
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      console.log(`[Proxy] Requesting: ${targetUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout
      
      let response: Response;
      try {
        response = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          redirect: 'follow',
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      console.log(`[Proxy] Target responded with status: ${response.status}`);
      
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      // Log the proxy attempt to a debug file
      try {
        const fs = await import('fs');
        const logMsg = `\n--- PROXY LOG START ---\nTimestamp: ${new Date().toISOString()}\nTarget: ${targetUrl}\nStatus: ${response.status}\nContent-Type: ${contentType}\nResponse Prefix (1000 chars):\n${text.substring(0, 1000)}\n--- PROXY LOG END ---\n`;
        fs.appendFileSync('./src/proxy_debug.log', logMsg);
      } catch (logErr) {
        console.error("Failed to write to debug log:", logErr);
      }

      if (!response.ok) {
        console.error(`[Proxy] Target API error: ${response.status}`, text.substring(0, 200));
        
        let errorMessage = `Target API returned ${response.status}`;
        if (response.status === 401 || response.status === 403 || text.includes('goog-login-button')) {
          errorMessage = "401 Unauthorized: กรุณาตั้งค่า Google Apps Script ให้ 'Who has access: Anyone'";
        }
        
        return res.status(response.status).json({ error: errorMessage, details: text.substring(0, 500) });
      }

      // Robust cleaning and parsing function
      const cleanAndParseJSON = (rawText: string): any => {
        let cleaned = rawText.trim();
        try {
          return JSON.parse(cleaned);
        } catch (initialErr) {
          // Extract the first JSON object or array
          const firstBrace = cleaned.indexOf('{');
          const lastBrace = cleaned.lastIndexOf('}');
          const firstBracket = cleaned.indexOf('[');
          const lastBracket = cleaned.lastIndexOf(']');
          
          let startIdx = -1;
          let endIdx = -1;
          
          if (firstBrace !== -1 && lastBrace !== -1) {
            if (firstBracket !== -1 && firstBracket < firstBrace && lastBracket !== -1 && lastBracket > lastBrace) {
              startIdx = firstBracket;
              endIdx = lastBracket;
            } else {
              startIdx = firstBrace;
              endIdx = lastBrace;
            }
          } else if (firstBracket !== -1 && lastBracket !== -1) {
            startIdx = firstBracket;
            endIdx = lastBracket;
          }
          
          if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            cleaned = cleaned.substring(startIdx, endIdx + 1);
          }

          try {
            return JSON.parse(cleaned);
          } catch (extractErr) {
            // Strip single-line and multi-line comments
            cleaned = cleaned.replace(/\/\/.*$/gm, '');
            cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
            // Fix unquoted keys
            cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            // Remove trailing commas before closing braces/brackets
            cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
            
            return JSON.parse(cleaned);
          }
        }
      };

      // Check if it's actually JSON even if content-type says otherwise, or if content-type is missing
      try {
        const json = cleanAndParseJSON(text);
        return res.json(json);
      } catch (e: any) {
        console.error(`[Proxy] Failed to parse target response as JSON. Content-Type: ${contentType}. Error: ${e.message}`);
        
        if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
          let pageTitle = "";
          const titleMatch = text.match(/<title>([^<]*)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            pageTitle = ` - "${titleMatch[1].trim()}"`;
          } else {
            const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            pageTitle = ` - "${cleanText.substring(0, 80)}..."`;
          }
          return res.status(422).json({ 
            error: `ได้รับข้อมูลเป็น HTML${pageTitle} แทนที่จะเป็น JSON. โปรดตรวจสอบว่าได้เผยแพร่ Google Apps Script แบบ 'Anyone' และ URL ถูกต้อง`,
            details: text.substring(0, 200)
          });
        }
        
        return res.status(422).json({ 
          error: `ข้อมูลที่ได้รับจาก URL ไม่ใช่รูปแบบ JSON ที่ถูกต้อง (${e.message})`,
          details: text.substring(0, 200)
        });
      }
    } catch (error: any) {
      console.error('[Proxy] Failure:', error);
      let errMsg = `Proxy failure: ${error.message}`;
      if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('Timeout')) {
        errMsg = "การเชื่อมต่อไปยัง Google Apps Script หมดเวลา (60 วินาที) โปรดตรวจสอบความเร็วเซิร์ฟเวอร์หรือลองอีกครั้ง";
      }
      res.status(500).json({ error: errMsg });
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
