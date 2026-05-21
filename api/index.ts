import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// Proxy API route to avoid CORS issues with Google Apps Script
app.get('/api/proxy', async (req: express.Request, res: express.Response) => {
  const targetUrl = req.query.url as string;
  
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

    try {
      const json = JSON.parse(text);
      return res.json(json);
    } catch (e) {
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
    res.status(500).json({ error: `Proxy failure: ${error.message}` });
  }
});

// Health check endpoint
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
