const http = require("http");

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html");
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>AskHoku Tunnel Test</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
          }
          h1 {
            color: #0066cc;
            text-align: center;
          }
          .success {
            background-color: #e6f7ff;
            border: 1px solid #91d5ff;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
          }
          .info {
            margin-top: 30px;
            background-color: #f6f6f6;
            padding: 15px;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <h1>AskHoku Tunnel Test</h1>
        <div class="success">
          <h2>🎉 Success! The tunnel is working.</h2>
          <p>Your local service is now accessible through Cloudflare Tunnel.</p>
        </div>
        <div class="info">
          <h3>Request Details:</h3>
          <p><strong>URL:</strong> ${req.url}</p>
          <p><strong>Method:</strong> ${req.method}</p>
          <p><strong>Headers:</strong></p>
          <pre>${JSON.stringify(req.headers, null, 2)}</pre>
        </div>
      </body>
    </html>
  `);
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
