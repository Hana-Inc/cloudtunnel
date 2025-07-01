#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import fs from "fs-extra";
import chalk from "chalk";
import { execSync, exec, spawn, SpawnOptions } from "child_process";
import path from "path";
import YAML from "yaml";
import os from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";

// Get the directory of the current module for package.json access
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Config types
interface Service {
  hostname: string;
  service: string;
  createdAt?: string;
  updatedAt?: string;
  protocol?: string;
  port?: string;
}

interface Tunnel {
  id: string;
  name: string;
  created_at?: string;
  connections?: any[];
  status?: string;
}

interface Config {
  version: string;
  activeTunnel?: string;
  tunnels: {
    [tunnelId: string]: {
      tunnelName: string;
      tunnelId: string;
      services: Service[];
      createdAt: string;
      lastUsed?: string;
    };
  };
}

// Constants
const CONFIG_VERSION = "2.0.0";
const CONFIG_DIR = path.join(os.homedir(), ".cloudflared");
const CONFIG_FILE = path.join(CONFIG_DIR, "cloudtunnel-config.json");
const CERT_FILE = path.join(CONFIG_DIR, "cert.pem");
const LOG_FILE = path.join(CONFIG_DIR, "cloudtunnel.log");

// Initialize program
const program = new Command();

// Utility functions
function log(message: string, level: "info" | "error" | "warn" = "info") {
  const timestamp = new Date().toISOString();
  const coloredMessage = 
    level === "error" ? chalk.red(message) :
    level === "warn" ? chalk.yellow(message) :
    chalk.cyan(message);
  
  console.log(coloredMessage);
  
  // Also write to log file
  try {
    fs.ensureDirSync(CONFIG_DIR);
    fs.appendFileSync(LOG_FILE, `[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
  } catch (err) {
    // Ignore logging errors
  }
}

function checkCloudflaredInstalled(): boolean {
  try {
    execSync("cloudflared --version", { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

function ensureCloudflaredInstalled(): void {
  if (!checkCloudflaredInstalled()) {
    log("Error: cloudflared is not installed or not in the PATH.", "error");
    log("Please install cloudflared using one of the following methods:", "warn");
    log("  macOS: brew install cloudflare/cloudflare/cloudflared", "info");
    log("  Windows: choco install cloudflared", "info");
    log("  Linux: See https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation", "info");
    process.exit(1);
  }
}

function isLoggedIn(): boolean {
  return fs.existsSync(CERT_FILE);
}

function ensureLoggedIn(): void {
  if (!isLoggedIn()) {
    log("Error: You need to log in to Cloudflare first.", "error");
    log("Please run 'cloudtunnel login' before continuing.", "warn");
    process.exit(1);
  }
}

function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { version: CONFIG_VERSION, tunnels: {} };
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    
    // Migrate old config format if needed
    if (!config.version || config.version !== CONFIG_VERSION) {
      if (config.tunnelId && config.tunnelName) {
        // Old single-tunnel format
        const oldConfig = config;
        return {
          version: CONFIG_VERSION,
          activeTunnel: oldConfig.tunnelId,
          tunnels: {
            [oldConfig.tunnelId]: {
              tunnelName: oldConfig.tunnelName,
              tunnelId: oldConfig.tunnelId,
              services: oldConfig.services || [],
              createdAt: new Date().toISOString()
            }
          }
        };
      }
    }
    
    return config;
  } catch (error) {
    log(`Error parsing config file: ${error}`, "error");
    return { version: CONFIG_VERSION, tunnels: {} };
  }
}

function saveConfig(config: Config): void {
  fs.ensureDirSync(CONFIG_DIR);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getActiveTunnel(config: Config) {
  if (!config.activeTunnel || !config.tunnels[config.activeTunnel]) {
    return null;
  }
  return config.tunnels[config.activeTunnel];
}

function validateHostname(hostname: string): boolean {
  const hostnameRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return hostnameRegex.test(hostname);
}

function checkServiceHealth(port: string): Promise<boolean> {
  return new Promise((resolve) => {
    const net = createRequire(import.meta.url)("net");
    const client = new net.Socket();
    
    client.setTimeout(1000);
    
    client.on("connect", () => {
      client.destroy();
      resolve(true);
    });
    
    client.on("error", () => {
      resolve(false);
    });
    
    client.on("timeout", () => {
      client.destroy();
      resolve(false);
    });
    
    client.connect(parseInt(port), "localhost");
  });
}

function getTunnelStatus(tunnelId: string): "running" | "stopped" | "unknown" {
  try {
    const tunnels = JSON.parse(
      execSync("cloudflared tunnel list --output json").toString()
    ) as Tunnel[];
    
    const tunnel = tunnels.find(t => t.id === tunnelId);
    if (!tunnel) return "unknown";
    
    // Check if tunnel has active connections
    if (tunnel.connections && tunnel.connections.length > 0) {
      return "running";
    }
    
    // Also check local processes
    if (process.platform === "win32") {
      try {
        const result = execSync(`wmic process where "commandline like '%${tunnelId}%' and name='cloudflared.exe'" get processid`).toString();
        if (result.includes(tunnelId)) return "running";
      } catch (e) {
        // Process not found
      }
    } else {
      try {
        execSync(`pgrep -f "cloudflared.*${tunnelId}"`);
        return "running";
      } catch (e) {
        // Process not found
      }
    }
    
    return "stopped";
  } catch (error) {
    return "unknown";
  }
}

function getPackageVersion(): string {
  try {
    const packagePath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return packageJson.version;
  } catch (error) {
    return "unknown";
  }
}

// Commands

program
  .name("cloudtunnel")
  .description("A user-friendly CLI for managing Cloudflare Tunnels")
  .version(getPackageVersion());

// Login command
program
  .command("login")
  .description("Authenticate with your Cloudflare account")
  .option("-f, --force", "Force login even if already authenticated")
  .action(async (options: { force?: boolean }) => {
    ensureCloudflaredInstalled();
    
    if (isLoggedIn() && !options.force) {
      const answers = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: `Already logged in. Do you want to re-authenticate?`,
          default: false,
        },
      ]);
      
      if (!answers.overwrite) {
        log("Using existing authentication.", "info");
        return;
      }
      
      fs.removeSync(CERT_FILE);
    }
    
    try {
      log("Opening browser to login with Cloudflare...", "info");
      execSync("cloudflared tunnel login", { stdio: "inherit" });
      
      if (isLoggedIn()) {
        log("Login successful! ✓", "info");
      } else {
        log("Login failed. Certificate not found.", "error");
        process.exit(1);
      }
    } catch (err) {
      log(`Login error: ${err}`, "error");
      process.exit(1);
    }
  });

// Init command
program
  .command("init")
  .description("Initialize a new Cloudflare Tunnel")
  .option("-n, --name <name>", "Tunnel name (skips prompt)")
  .option("-u, --use-existing", "Select from existing tunnels")
  .action(async (options: { name?: string; useExisting?: boolean }) => {
    ensureCloudflaredInstalled();
    ensureLoggedIn();
    
    const config = loadConfig();
    
    if (options.useExisting) {
      try {
        const output = execSync("cloudflared tunnel list --output json").toString();
        const tunnels: Tunnel[] = JSON.parse(output);
        
        if (tunnels.length === 0) {
          log("No existing tunnels found.", "warn");
          const answers = await inquirer.prompt([
            {
              type: "confirm",
              name: "createNew",
              message: "Create a new tunnel instead?",
              default: true,
            },
          ]);
          
          if (!answers.createNew) return;
        } else {
          const choices = tunnels.map(t => ({
            name: `${t.name} (${t.id}) - ${getTunnelStatus(t.id)}`,
            value: { id: t.id, name: t.name },
          }));
          
          const answer = await inquirer.prompt([
            {
              type: "list",
              name: "tunnel",
              message: "Select a tunnel:",
              choices,
            },
          ]);
          
          config.tunnels[answer.tunnel.id] = {
            tunnelName: answer.tunnel.name,
            tunnelId: answer.tunnel.id,
            services: config.tunnels[answer.tunnel.id]?.services || [],
            createdAt: config.tunnels[answer.tunnel.id]?.createdAt || new Date().toISOString(),
            lastUsed: new Date().toISOString(),
          };
          config.activeTunnel = answer.tunnel.id;
          saveConfig(config);
          log(`Selected tunnel: ${answer.tunnel.name}`, "info");
          return;
        }
      } catch (err) {
        log(`Error listing tunnels: ${err}`, "error");
      }
    }
    
    // Create new tunnel
    const tunnelName = options.name || (await inquirer.prompt([
      {
        type: "input",
        name: "tunnelName",
        message: "Enter a name for your tunnel:",
        validate: (input) => !!input.trim() || "Tunnel name cannot be empty.",
      },
    ])).tunnelName;
    
    try {
      log(`Creating tunnel: ${tunnelName}...`, "info");
      const output = execSync(`cloudflared tunnel create ${tunnelName}`).toString();
      
      const match = output.match(/Created tunnel .* with id ([a-f0-9-]+)/i);
      if (match && match[1]) {
        const tunnelId = match[1];
        
        config.tunnels[tunnelId] = {
          tunnelName,
          tunnelId,
          services: [],
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        };
        config.activeTunnel = tunnelId;
        saveConfig(config);
        
        log(`Tunnel created successfully! ID: ${tunnelId}`, "info");
        log("Next: Add services with 'cloudtunnel add'", "info");
      } else {
        log("Failed to parse tunnel ID from output.", "error");
      }
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        log("A tunnel with this name already exists.", "error");
      } else {
        log(`Error creating tunnel: ${err}`, "error");
      }
      process.exit(1);
    }
  });

// Add service command
program
  .command("add")
  .alias("add-service")
  .description("Add a service to your tunnel")
  .option("-h, --hostname <hostname>", "Hostname (e.g., app.example.com)")
  .option("-p, --port <port>", "Local port number")
  .option("-s, --protocol <protocol>", "Protocol (http/https)", "http")
  .action(async (options: { hostname?: string; port?: string; protocol?: string }) => {
    ensureCloudflaredInstalled();
    ensureLoggedIn();
    
    const config = loadConfig();
    const activeTunnel = getActiveTunnel(config);
    
    if (!activeTunnel) {
      log("No active tunnel. Run 'cloudtunnel init' first.", "error");
      return;
    }
    
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "hostname",
        message: "Hostname (e.g., app.example.com):",
        when: !options.hostname,
        validate: (input) => {
          if (!input) return "Hostname cannot be empty.";
          if (!validateHostname(input)) return "Invalid hostname format.";
          if (activeTunnel.services.some(s => s.hostname === input)) {
            return "This hostname is already configured.";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "port",
        message: "Local port:",
        when: !options.port,
        validate: (input) => {
          const port = parseInt(input, 10);
          if (isNaN(port) || port <= 0 || port > 65535) {
            return "Port must be between 1 and 65535.";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "protocol",
        message: "Protocol:",
        choices: ["http", "https"],
        when: !options.protocol,
        default: "http",
      },
    ]);
    
    const hostname = options.hostname || answers.hostname;
    const port = options.port || answers.port;
    const protocol = options.protocol || answers.protocol;
    
    // Check if service is running
    const isRunning = await checkServiceHealth(port);
    if (!isRunning) {
      log(`Warning: No service detected on port ${port}`, "warn");
      const proceed = await inquirer.prompt([
        {
          type: "confirm",
          name: "continue",
          message: "Continue anyway?",
          default: true,
        },
      ]);
      if (!proceed.continue) return;
    }
    
    // Add to config
    const service: Service = {
      hostname,
      service: `${protocol}://localhost:${port}`,
      protocol,
      port,
      createdAt: new Date().toISOString(),
    };
    
    activeTunnel.services.push(service);
    saveConfig(config);
    
    // Create DNS route
    try {
      log(`Creating DNS route for ${hostname}...`, "info");
      execSync(`cloudflared tunnel route dns ${activeTunnel.tunnelId} ${hostname}`, {
        stdio: "inherit",
      });
      log(`✓ Service added: ${hostname} → ${protocol}://localhost:${port}`, "info");
    } catch (err: any) {
      log(`Warning: DNS route creation failed: ${err.message}`, "warn");
      log("The service was added to config but DNS may need manual setup.", "warn");
    }
  });

// List command
program
  .command("list")
  .alias("list-services")
  .description("List all tunnels and services")
  .option("-j, --json", "Output as JSON")
  .action((options: { json?: boolean }) => {
    const config = loadConfig();
    
    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }
    
    const tunnelCount = Object.keys(config.tunnels).length;
    if (tunnelCount === 0) {
      log("No tunnels configured. Run 'cloudtunnel init' to get started.", "warn");
      return;
    }
    
    console.log(chalk.bold(`\nConfigured Tunnels (${tunnelCount}):`));
    
    for (const [tunnelId, tunnel] of Object.entries(config.tunnels)) {
      const isActive = config.activeTunnel === tunnelId;
      const status = getTunnelStatus(tunnelId);
      const statusIcon = status === "running" ? "🟢" : status === "stopped" ? "🔴" : "🟡";
      
      console.log(`\n${isActive ? chalk.green("► ") : "  "}${chalk.bold(tunnel.tunnelName)} ${statusIcon}`);
      console.log(`  ID: ${chalk.dim(tunnelId)}`);
      console.log(`  Services: ${tunnel.services.length}`);
      
      if (tunnel.services.length > 0) {
        tunnel.services.forEach((srv, idx) => {
          console.log(`    ${idx + 1}. ${chalk.cyan(srv.hostname)} → ${srv.service}`);
        });
      }
    }
    
    if (config.activeTunnel) {
      console.log(`\n${chalk.dim("Active tunnel:")} ${config.tunnels[config.activeTunnel].tunnelName}`);
    }
  });

// Remove service command
program
  .command("remove")
  .alias("remove-service")
  .description("Remove a service from your tunnel")
  .action(async () => {
    const config = loadConfig();
    const activeTunnel = getActiveTunnel(config);
    
    if (!activeTunnel || activeTunnel.services.length === 0) {
      log("No services to remove.", "warn");
      return;
    }
    
    const choices = activeTunnel.services.map((srv, idx) => ({
      name: `${srv.hostname} → ${srv.service}`,
      value: idx,
    }));
    
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "serviceIndex",
        message: "Select a service to remove:",
        choices,
      },
    ]);
    
    const removed = activeTunnel.services.splice(answer.serviceIndex, 1)[0];
    saveConfig(config);
    
    log(`Removed service: ${removed.hostname}`, "info");
    log("Note: DNS records were not removed. You may need to clean them up manually.", "warn");
  });

// Switch tunnel command
program
  .command("switch")
  .description("Switch active tunnel")
  .action(async () => {
    const config = loadConfig();
    const tunnelIds = Object.keys(config.tunnels);
    
    if (tunnelIds.length === 0) {
      log("No tunnels configured.", "warn");
      return;
    }
    
    if (tunnelIds.length === 1) {
      log("Only one tunnel configured.", "info");
      return;
    }
    
    const choices = tunnelIds.map(id => ({
      name: `${config.tunnels[id].tunnelName} (${id}) ${id === config.activeTunnel ? "[current]" : ""}`,
      value: id,
    }));
    
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "tunnelId",
        message: "Select tunnel to switch to:",
        choices,
      },
    ]);
    
    config.activeTunnel = answer.tunnelId;
    config.tunnels[answer.tunnelId].lastUsed = new Date().toISOString();
    saveConfig(config);
    
    log(`Switched to tunnel: ${config.tunnels[answer.tunnelId].tunnelName}`, "info");
  });

// Run command
program
  .command("run")
  .description("Run the active tunnel")
  .option("-d, --detach", "Run in background")
  .option("-t, --tunnel <id>", "Run specific tunnel by ID")
  .action(async (options: { detach?: boolean; tunnel?: string }) => {
    ensureCloudflaredInstalled();
    ensureLoggedIn();
    
    const config = loadConfig();
    const tunnelId = options.tunnel || config.activeTunnel;
    
    if (!tunnelId || !config.tunnels[tunnelId]) {
      log("No tunnel selected. Run 'cloudtunnel init' first.", "error");
      return;
    }
    
    const tunnel = config.tunnels[tunnelId];
    
    // Check if already running
    const status = getTunnelStatus(tunnelId);
    if (status === "running") {
      log(`Tunnel ${tunnel.tunnelName} is already running.`, "warn");
      return;
    }
    
    // Generate config file
    const configPath = path.join(CONFIG_DIR, `tunnel-${tunnelId}.yml`);
    
    const ingressRules: Array<{ hostname?: string; service: string }> = tunnel.services.map(srv => ({
      hostname: srv.hostname,
      service: srv.service,
    }));
    
    ingressRules.push({ service: "http_status:404" });
    
    const tunnelConfig = {
      tunnel: tunnelId,
      credentials: path.join(CONFIG_DIR, `${tunnelId}.json`),
      ingress: ingressRules,
    };
    
    fs.writeFileSync(configPath, YAML.stringify(tunnelConfig));
    
    log(`Starting tunnel: ${tunnel.tunnelName}`, "info");
    
    if (tunnel.services.length > 0) {
      console.log(chalk.green("\nServices:"));
      for (const srv of tunnel.services) {
        const isHealthy = await checkServiceHealth(srv.port || "80");
        const healthIcon = isHealthy ? "✓" : "✗";
        console.log(`  ${healthIcon} https://${chalk.bold(srv.hostname)} → ${srv.service}`);
      }
    }
    
    try {
      if (options.detach) {
        // Run detached
        const spawnOptions: SpawnOptions = {
          detached: true,
          stdio: "ignore",
        };
        
        const child = spawn("cloudflared", ["tunnel", "--config", configPath, "run"], spawnOptions);
        child.unref();
        
        log("\nTunnel started in background.", "info");
        log("Use 'cloudtunnel stop' to stop it.", "info");
      } else {
        // Run in foreground
        log("\nPress Ctrl+C to stop the tunnel.", "info");
        execSync(`cloudflared tunnel --config ${configPath} run`, { stdio: "inherit" });
      }
    } catch (err: any) {
      if (!err.message?.includes("SIGINT")) {
        log(`Error running tunnel: ${err.message}`, "error");
      }
    }
  });

// Stop command
program
  .command("stop")
  .description("Stop running tunnel(s)")
  .option("-a, --all", "Stop all running tunnels")
  .option("-t, --tunnel <id>", "Stop specific tunnel")
  .action(async (options: { all?: boolean; tunnel?: string }) => {
    const config = loadConfig();
    
    let tunnelIds: string[] = [];
    
    if (options.all) {
      tunnelIds = Object.keys(config.tunnels);
    } else if (options.tunnel) {
      tunnelIds = [options.tunnel];
    } else if (config.activeTunnel) {
      tunnelIds = [config.activeTunnel];
    }
    
    if (tunnelIds.length === 0) {
      log("No tunnel specified.", "error");
      return;
    }
    
    for (const tunnelId of tunnelIds) {
      const tunnel = config.tunnels[tunnelId];
      if (!tunnel) continue;
      
      log(`Stopping tunnel: ${tunnel.tunnelName}...`, "info");
      
      try {
        if (process.platform === "win32") {
          execSync(`taskkill /F /FI "WINDOWTITLE eq cloudflared*${tunnelId}*"`);
        } else {
          execSync(`pkill -f "cloudflared.*${tunnelId}"`);
        }
        log(`Stopped: ${tunnel.tunnelName}`, "info");
      } catch (err) {
        log(`Could not stop ${tunnel.tunnelName} (may not be running)`, "warn");
      }
    }
  });

// Status command
program
  .command("status")
  .description("Show tunnel status")
  .action(() => {
    ensureCloudflaredInstalled();
    
    const config = loadConfig();
    
    if (Object.keys(config.tunnels).length === 0) {
      log("No tunnels configured.", "warn");
      return;
    }
    
    console.log(chalk.bold("\nTunnel Status:"));
    
    for (const [tunnelId, tunnel] of Object.entries(config.tunnels)) {
      const status = getTunnelStatus(tunnelId);
      const statusText = 
        status === "running" ? chalk.green("Running") :
        status === "stopped" ? chalk.red("Stopped") :
        chalk.yellow("Unknown");
      
      console.log(`\n${tunnel.tunnelName}: ${statusText}`);
      console.log(`  ID: ${chalk.dim(tunnelId)}`);
      console.log(`  Services: ${tunnel.services.length}`);
    }
  });

// Export command
program
  .command("export")
  .description("Export tunnel configuration")
  .option("-t, --tunnel <id>", "Export specific tunnel")
  .action((options: { tunnel?: string }) => {
    const config = loadConfig();
    
    if (options.tunnel) {
      const tunnel = config.tunnels[options.tunnel];
      if (!tunnel) {
        log("Tunnel not found.", "error");
        return;
      }
      console.log(JSON.stringify(tunnel, null, 2));
    } else {
      console.log(JSON.stringify(config, null, 2));
    }
  });

// Import command
program
  .command("import <file>")
  .description("Import tunnel configuration from file")
  .action(async (file: string) => {
    try {
      const importData = JSON.parse(fs.readFileSync(file, "utf8"));
      const config = loadConfig();
      
      // Import single tunnel
      if (importData.tunnelId && importData.tunnelName) {
        config.tunnels[importData.tunnelId] = importData;
        saveConfig(config);
        log(`Imported tunnel: ${importData.tunnelName}`, "info");
      }
      // Import full config
      else if (importData.tunnels) {
        Object.assign(config.tunnels, importData.tunnels);
        saveConfig(config);
        log(`Imported ${Object.keys(importData.tunnels).length} tunnels`, "info");
      } else {
        log("Invalid import file format.", "error");
      }
    } catch (err) {
      log(`Import error: ${err}`, "error");
    }
  });

// Clean command
program
  .command("clean")
  .description("Clean up invalid tunnels from config")
  .action(async () => {
    ensureCloudflaredInstalled();
    ensureLoggedIn();
    
    const config = loadConfig();
    
    try {
      const output = execSync("cloudflared tunnel list --output json").toString();
      const remoteTunnels: Tunnel[] = JSON.parse(output);
      const remoteTunnelIds = new Set(remoteTunnels.map(t => t.id));
      
      const invalidTunnels = Object.keys(config.tunnels).filter(
        id => !remoteTunnelIds.has(id)
      );
      
      if (invalidTunnels.length === 0) {
        log("All tunnels in config are valid.", "info");
        return;
      }
      
      log(`Found ${invalidTunnels.length} invalid tunnel(s) in config.`, "warn");
      
      const answer = await inquirer.prompt([
        {
          type: "confirm",
          name: "remove",
          message: "Remove invalid tunnels from config?",
          default: true,
        },
      ]);
      
      if (answer.remove) {
        invalidTunnels.forEach(id => {
          log(`Removing: ${config.tunnels[id].tunnelName}`, "info");
          delete config.tunnels[id];
        });
        
        if (config.activeTunnel && invalidTunnels.includes(config.activeTunnel)) {
          config.activeTunnel = undefined;
        }
        
        saveConfig(config);
        log("Config cleaned.", "info");
      }
    } catch (err) {
      log(`Error checking tunnels: ${err}`, "error");
    }
  });

// Version command
program
  .command("version")
  .description("Show version information")
  .action(() => {
    console.log(`cloudtunnel: ${chalk.green(getPackageVersion())}`);
    
    try {
      const cloudflaredVersion = execSync("cloudflared --version 2>&1").toString().trim();
      console.log(`cloudflared: ${chalk.green(cloudflaredVersion)}`);
    } catch (err) {
      console.log(`cloudflared: ${chalk.yellow("Not installed (optional for version check)")}`);
    }
    
    console.log(`Config version: ${chalk.green(CONFIG_VERSION)}`);
    console.log(`Config location: ${chalk.dim(CONFIG_FILE)}`);
  });

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}