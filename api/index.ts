import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// Proxy API route to avoid CORS issues with Google Apps Script
app.get('/api/proxy', async (req: express.Request, res: express.Response) => {
  let targetUrl = (req.query.url as string || '').trim();
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok) {
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

    try {
      const json = cleanAndParseJSON(text);
      return res.json(json);
    } catch (e: any) {
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
    res.status(500).json({ error: `Proxy failure: ${error.message}` });
  }
});

// Health check endpoint
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
