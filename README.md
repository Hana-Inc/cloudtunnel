# ☁️🚇 CloudTunnel

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Cloudflare](https://img.shields.io/badge/cloudflare-integrated-orange)

> _Seamlessly connect your local environment to the world through Cloudflare Tunnels_

A powerful CLI tool that simplifies Cloudflare Tunnel management, extending cloudflared with intuitive commands for developers. Now with multi-tunnel support, service health checks, and advanced management features.

## ✨ Features

- **Multi-Tunnel Management** - Create and manage multiple tunnels, switch between them easily
- **Service Health Checks** - Automatic validation of local services before tunnel creation
- **Smart Configuration** - Automatic config migration and backup/restore capabilities
- **Visual Status Indicators** - Real-time tunnel and service status with emojis (🟢🔴🟡)
- **Cross-Platform** - Full support for Windows, macOS, and Linux
- **Advanced Commands** - Export/import configs, clean invalid tunnels, and more

## 📦 Installation

```bash
# Install globally via npm
npm install -g cloudtunnel

# Or with yarn
yarn global add cloudtunnel

# Or with pnpm
pnpm add -g cloudtunnel
```

## 📋 Prerequisites

- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation) installed on your system
- A Cloudflare account
- Node.js 16.x or higher

## 🚀 Quick Start

```bash
# 1. Authenticate with Cloudflare
cloudtunnel login

# 2. Create your first tunnel
cloudtunnel init

# 3. Add a service
cloudtunnel add

# 4. Start the tunnel
cloudtunnel run

# 5. Access your service via HTTPS!
```

## 📚 Commands

### 🔐 Authentication

```bash
# Log in to Cloudflare (opens browser)
cloudtunnel login

# Force re-authentication
cloudtunnel login --force
```

### 🚇 Tunnel Management

```bash
# Create a new tunnel
cloudtunnel init

# Create with a specific name (skip prompt)
cloudtunnel init --name my-tunnel

# Select from existing tunnels
cloudtunnel init --use-existing

# List all tunnels and services
cloudtunnel list

# Switch between tunnels
cloudtunnel switch

# Check tunnel status
cloudtunnel status
```

### 🌐 Service Management

```bash
# Add a service interactively
cloudtunnel add

# Add a service with options
cloudtunnel add --hostname app.example.com --port 3000 --protocol http

# List all services (with visual status)
cloudtunnel list

# List as JSON (for scripting)
cloudtunnel list --json

# Remove a service
cloudtunnel remove
```

### ▶️ Running Tunnels

```bash
# Run tunnel in foreground (Ctrl+C to stop)
cloudtunnel run

# Run in background/detached mode
cloudtunnel run --detach

# Run a specific tunnel by ID
cloudtunnel run --tunnel <tunnel-id>

# Stop the active tunnel
cloudtunnel stop

# Stop a specific tunnel
cloudtunnel stop --tunnel <tunnel-id>

# Stop all running tunnels
cloudtunnel stop --all
```

### 🛠️ Maintenance & Utilities

```bash
# Clean up invalid tunnels from config
cloudtunnel clean

# Export tunnel configuration
cloudtunnel export
cloudtunnel export --tunnel <tunnel-id>

# Import tunnel configuration
cloudtunnel import config.json

# Check versions
cloudtunnel version
```

## 📁 Configuration

CloudTunnel stores its configuration in `~/.cloudflared/cloudtunnel-config.json`. The new v2 format supports:

- Multiple tunnel configurations
- Active tunnel tracking
- Service metadata (creation time, protocol, port)
- Automatic config migration from v1

### Configuration Structure

```json
{
  "version": "2.0.0",
  "activeTunnel": "tunnel-id",
  "tunnels": {
    "tunnel-id": {
      "tunnelName": "my-app",
      "tunnelId": "uuid",
      "services": [{
        "hostname": "app.example.com",
        "service": "http://localhost:3000",
        "protocol": "http",
        "port": "3000",
        "createdAt": "2024-01-01T00:00:00Z"
      }],
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsed": "2024-01-01T00:00:00Z"
    }
  }
}
```

## 🧪 Testing Your Tunnel

CloudTunnel includes an enhanced test server that helps verify your tunnel setup:

```bash
# Clone the repository
git clone https://github.com/Hana-Inc/cloudtunnel.git
cd cloudtunnel

# Start the test server
npm run test-server
```

The test server runs on port 3000 by default and includes:
- Visual confirmation of tunnel connectivity
- Request detail display
- Service health endpoint at `/health`
- Echo endpoint at `/echo` for debugging

## 📖 Example Workflows

### Basic Web App Deployment

```bash
# Setup
cloudtunnel login
cloudtunnel init --name my-web-app

# Add your services
cloudtunnel add --hostname app.mydomain.com --port 3000
cloudtunnel add --hostname api.mydomain.com --port 4000

# Run the tunnel
cloudtunnel run
```

### Multi-Environment Setup

```bash
# Create tunnels for different environments
cloudtunnel init --name production
cloudtunnel init --name staging
cloudtunnel init --name development

# Switch between them
cloudtunnel switch  # Interactive selection
cloudtunnel list    # See all tunnels

# Run specific tunnel
cloudtunnel run --tunnel <staging-tunnel-id>
```

### Backup and Migration

```bash
# Export current configuration
cloudtunnel export > tunnels-backup.json

# On new machine
cloudtunnel import tunnels-backup.json
cloudtunnel login  # Re-authenticate
```

## 🔧 Troubleshooting

### Service Not Accessible

If your service shows a ✗ when running the tunnel:
1. Ensure your local service is running on the specified port
2. Check firewall settings
3. Verify the port number in your configuration

### DNS Propagation

After adding a service, DNS changes may take a few minutes to propagate. The tunnel will work once DNS updates globally.

### Permission Errors

If you see permission errors when creating DNS routes:
1. Verify you have access to the domain in Cloudflare
2. Check that your Cloudflare account has the necessary permissions
3. Ensure the domain is active in your Cloudflare account

### Multiple Tunnel Instances

To avoid conflicts:
1. Use `cloudtunnel status` to check running tunnels
2. Stop existing tunnels before starting new ones
3. Use different tunnels for different projects

## 🏗️ Development

```bash
# Clone the repository
git clone https://github.com/Hana-Inc/cloudtunnel.git
cd cloudtunnel

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test
```

### Project Structure

```
cloudtunnel/
├── src/
│   ├── cli.ts         # Main CLI implementation
│   └── index.ts       # Entry point
├── test-server/       # Test server for tunnel verification
├── dist/             # Compiled output
└── package.json
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

MIT © [Hana-Inc](https://github.com/Hana-Inc)

## 🙏 Acknowledgments

- Built on top of [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/)
- Inspired by the need for simpler tunnel management
- Thanks to all contributors and users

---

<p align="center">Made with ❤️ by developers, for developers</p>