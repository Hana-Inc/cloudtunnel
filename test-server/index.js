const http = require("http");
const url = require("url");

const PORT = process.env.PORT || 3000;
let requestCount = 0;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  requestCount++;

  // Health check endpoint
  if (pathname === "/health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      status: "healthy",
      uptime: process.uptime(),
      requests: requestCount,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Echo endpoint for debugging
  if (pathname === "/echo") {
    const body = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: parsedUrl.query,
      timestamp: new Date().toISOString()
    };
    
    if (req.method === "POST" || req.method === "PUT") {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => {
        body.body = data;
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body, null, 2));
      });
      return;
    }
    
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body, null, 2));
    return;
  }

  // Main page
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html");
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>CloudTunnel Test Server</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root {
            --primary: #0066cc;
            --success: #10b981;
            --bg-light: #f3f4f6;
            --text: #1f2937;
            --border: #e5e7eb;
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--text);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            max-width: 800px;
            width: 100%;
            overflow: hidden;
          }
          
          .header {
            background: var(--primary);
            color: white;
            padding: 30px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 2rem;
            margin-bottom: 10px;
          }
          
          .status {
            background: var(--success);
            color: white;
            padding: 15px 30px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
          }
          
          .status-icon {
            width: 24px;
            height: 24px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .content {
            padding: 30px;
          }
          
          .section {
            margin-bottom: 30px;
          }
          
          .section h3 {
            color: var(--primary);
            margin-bottom: 15px;
            font-size: 1.2rem;
          }
          
          .info-grid {
            display: grid;
            gap: 15px;
          }
          
          .info-item {
            background: var(--bg-light);
            padding: 15px;
            border-radius: 8px;
            border: 1px solid var(--border);
          }
          
          .info-label {
            font-weight: 600;
            color: #6b7280;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 5px;
          }
          
          .info-value {
            font-family: 'Courier New', monospace;
            word-break: break-all;
          }
          
          .headers-list {
            background: #1f2937;
            color: #e5e7eb;
            padding: 20px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 0.875rem;
            overflow-x: auto;
            white-space: pre-wrap;
          }
          
          .endpoints {
            background: var(--bg-light);
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
          }
          
          .endpoint {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            font-family: 'Courier New', monospace;
          }
          
          .method {
            background: var(--primary);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            min-width: 50px;
            text-align: center;
          }
          
          .timestamp {
            text-align: center;
            color: #6b7280;
            font-size: 0.875rem;
            margin-top: 30px;
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          .pulse {
            animation: pulse 2s infinite;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>☁️ CloudTunnel Test Server</h1>
            <p>Your tunnel connection is working perfectly!</p>
          </div>
          
          <div class="status">
            <div class="status-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--success)">
                <path d="M13.5 3.5L6 11l-3.5-3.5L1 9l5 5L15 5z"/>
              </svg>
            </div>
            <span>TUNNEL ACTIVE</span>
          </div>
          
          <div class="content">
            <div class="section">
              <h3>📍 Request Details</h3>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Request URL</div>
                  <div class="info-value">${req.url}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Method</div>
                  <div class="info-value">${req.method}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Request Count</div>
                  <div class="info-value">#${requestCount}</div>
                </div>
              </div>
            </div>
            
            <div class="section">
              <h3>📋 Request Headers</h3>
              <div class="headers-list">${JSON.stringify(req.headers, null, 2)}</div>
            </div>
            
            <div class="section">
              <h3>🔗 Available Endpoints</h3>
              <div class="endpoints">
                <div class="endpoint">
                  <span class="method">GET</span>
                  <span>/</span>
                  <span style="color: #6b7280;">- This page</span>
                </div>
                <div class="endpoint">
                  <span class="method">GET</span>
                  <span>/health</span>
                  <span style="color: #6b7280;">- Health check endpoint (JSON)</span>
                </div>
                <div class="endpoint">
                  <span class="method">ANY</span>
                  <span>/echo</span>
                  <span style="color: #6b7280;">- Echo request details (JSON)</span>
                </div>
              </div>
            </div>
            
            <div class="timestamp pulse">
              Server Time: ${new Date().toISOString()}
            </div>
          </div>
        </div>
        
        <script>
          // Auto-refresh timestamp
          setInterval(() => {
            document.querySelector('.timestamp').innerHTML = 'Server Time: ' + new Date().toISOString();
          }, 1000);
          
          // Log to console for debugging
          console.log('CloudTunnel Test Server - Request received at:', new Date().toISOString());
          console.log('Request details:', {
            url: '${req.url}',
            method: '${req.method}',
            headers: ${JSON.stringify(req.headers)}
          });
        </script>
      </body>
    </html>
  `);
});

// Handle server errors
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
  } else {
    console.error("❌ Server error:", err);
  }
  process.exit(1);
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║       CloudTunnel Test Server Ready        ║
╠════════════════════════════════════════════╣
║                                            ║
║  🚀 Server running at:                     ║
║     http://localhost:${PORT}                  ║
║                                            ║
║  📍 Available endpoints:                   ║
║     GET  /        - Main test page         ║
║     GET  /health  - Health check (JSON)    ║
║     ANY  /echo    - Echo request (JSON)    ║
║                                            ║
║  💡 Add this to your tunnel:               ║
║     cloudtunnel add --port ${PORT}            ║
║                                            ║
║  Press Ctrl+C to stop                      ║
╚════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down test server...");
  server.close(() => {
    console.log("✅ Server stopped");
    process.exit(0);
  });
});