# Changelog

All notable changes to CloudTunnel will be documented in this file.

## [2.0.0] - 2024-01-20

### 🎉 Major Release - Multi-Tunnel Support

### ✨ New Features
- **Multi-tunnel management** - Create and manage multiple tunnels, switch between them seamlessly
- **Service health checks** - Automatic validation that local services are running before tunnel creation
- **Status indicators** - Visual status with emojis (🟢 running, 🔴 stopped, 🟡 unknown)
- **Command aliases** - Use `add` instead of `add-service`, `list` instead of `list-services`
- **Configuration import/export** - Backup and restore tunnel configurations
- **Clean command** - Remove invalid tunnels from configuration
- **Enhanced logging** - File-based logging with timestamps in `~/.cloudflared/cloudtunnel.log`
- **Service removal** - New `remove` command to delete services from tunnels
- **Switch command** - Easily switch between multiple tunnels
- **Status command** - Check running status of all tunnels
- **Tunnel-specific operations** - Run or stop specific tunnels with `--tunnel` flag

### 🐛 Bug Fixes
- Fixed package.json path resolution for global installations
- Improved Windows process detection and management
- Fixed detached mode to properly background processes
- Better error handling with specific, actionable error messages
- Fixed DNS route creation with better error recovery

### 💡 Improvements
- Migrated to ES modules for better compatibility
- Automatic config migration from v1 to v2 format
- Better cross-platform support (Windows, macOS, Linux)
- Enhanced CLI output with colors and formatting
- JSON output support for scripting (`--json` flag)
- Consistent prerequisite checking across all commands
- Improved user prompts and validation
- Better handling of DNS propagation delays

### 🏗️ Technical Changes
- Updated to Node.js 16+ requirement
- Switched to ES modules (`"type": "module"`)
- Enhanced TypeScript configuration
- Better type safety throughout the codebase
- Improved test server with health checks and echo endpoints

### 📝 Documentation
- Completely rewritten README with examples
- Added configuration structure documentation
- Included troubleshooting guide
- Example workflows for common use cases

## [1.5.3] - Previous Version

### Features
- Basic tunnel management
- Single tunnel support
- Service addition and listing
- Basic run/stop functionality

---

## Migration Guide (1.x → 2.0)

CloudTunnel 2.0 automatically migrates your configuration when you first run it. Your existing tunnel and services will be preserved.

### What's Changed:
1. **Config format** - Now supports multiple tunnels
2. **Command names** - Some commands have shorter aliases
3. **New features** - Many new commands available

### To migrate:
1. Update CloudTunnel: `npm update -g cloudtunnel`
2. Run any command (e.g., `cloudtunnel list`)
3. Your config will be automatically migrated

Your existing tunnel will become the "active" tunnel, and you can add more tunnels as needed.