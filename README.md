# ☁️🚇 CloudTunnel

![Version](https://img.shields.io/badge/version-1.5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Cloudflare](https://img.shields.io/badge/cloudflare-integrated-orange)

> _Seamlessly connect your local environment to the world through Cloudflare Tunnels_

A powerful CLI tool that simplifies Cloudflare Tunnel management, extending cloudflared with intuitive commands for developers.

## Installation

```bash
# Install globally via npm
npm install -g cloudtunnel

# Or with yarn
yarn global add cloudtunnel
```

## Prerequisites

- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation) installed on your system
- A Cloudflare account
- Node.js 14.x or higher

## Quick Start

```bash
# Authenticate with Cloudflare
cloudtunnel login

# Create a new tunnel
cloudtunnel init

# Add a service to your tunnel
cloudtunnel add-service

# Start your tunnel
cloudtunnel run
```

## Commands

### Authentication

```bash
# Log in to Cloudflare
cloudtunnel login

# Force reauthorization
cloudtunnel login --force
```

### Tunnel Management

```bash
# Initialize a new tunnel
cloudtunnel init

# Use an existing tunnel
cloudtunnel init --use-existing

# Force creation of a new tunnel
cloudtunnel init --force
```

### Service Management

```bash
# Add a service to your tunnel
cloudtunnel add-service

# List all configured services
cloudtunnel list-services

# Get JSON output of services
cloudtunnel list-services --json

# Remove a service
cloudtunnel remove-service

# Remove a service without confirmation
cloudtunnel remove-service --force

# Remove service with DNS cleanup guidance
cloudtunnel remove-service --delete-dns
```

### Running Tunnels

```bash
# Run your tunnel in the foreground
cloudtunnel run

# Run your tunnel in the background
cloudtunnel run --detach

# Stop a running tunnel
cloudtunnel stop

# Force stop a tunnel
cloudtunnel stop --force
```

### Utility Commands

```bash
# Check version information
cloudtunnel version
```

## Configuration

CloudTunnel stores its configuration in `~/.cloudflared/cloudtunnel-config.json`. This includes:

- Your tunnel ID and name
- Services you've configured (hostname, port, protocol)

## Troubleshooting

### Certificate Issues

If you encounter an error about an existing certificate:

```
You have an existing certificate at ~/.cloudflared/cert.pem which login would overwrite.
```

You have two options:

1. Run `cloudtunnel login --force` to overwrite the existing certificate
2. Delete the certificate manually: `rm ~/.cloudflared/cert.pem`

### Tunnel Already Running

If you see an error about the tunnel already running:

```
Error running tunnel: Error: exit status 1
```

Check if the tunnel is already running in another process and stop it first:

```bash
cloudtunnel stop
```

### Domain and Certificate Configuration

For best results:

- Use domains that are covered by existing Cloudflare certificates
- The structure `*.dev.yourdomain.com` works well with Cloudflare's automatic certificates
- For complex subdomain structures, you may need to set up custom edge certificates in Cloudflare

## Example Workflow

```bash
# First-time setup
cloudtunnel login
cloudtunnel init

# Add services to your tunnel
cloudtunnel add-service
# Follow prompts to add hostname and port

# List your services
cloudtunnel list-services

# Run your tunnel
cloudtunnel run

# Run in background mode
cloudtunnel run --detach

# Stop the tunnel when done
cloudtunnel stop
```

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/cloudtunnel.git
cd cloudtunnel

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the project
npm run build
```

## License

MIT
