#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import fs from "fs-extra";
import chalk from "chalk";
import { execSync, exec, ExecSyncOptions } from "child_process";
import path from "path";
import YAML from "yaml";

const program = new Command();

// Config types
interface Service {
  hostname: string;
  service: string;
  createdAt?: string;
}

interface Config {
  tunnelName: string;
  tunnelId: string;
  services: Service[];
}

interface Tunnel {
  id: string;
  name: string;
  created_at?: string;
  connections?: any[];
}

// Default config paths
const CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".cloudflared"
);
const CONFIG_FILE = path.join(CONFIG_DIR, "askhoku-config.json");
const CERT_FILE = path.join(CONFIG_DIR, "cert.pem");

/**
 * Check if cloudflared is installed
 */
function checkCloudflaredInstalled(): boolean {
  try {
    execSync("cloudflared --version", { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Load local config. Creates an empty JSON if not found.
 */
function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { tunnelName: "", tunnelId: "", services: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch (error) {
    console.error(
      chalk.red(`Error parsing config file at ${CONFIG_FILE}:`),
      error
    );
    return { tunnelName: "", tunnelId: "", services: [] };
  }
}

/**
 * Save local config.
 */
function saveConfig(config: Config): void {
  fs.ensureDirSync(CONFIG_DIR);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Check if already logged in to Cloudflare
 */
function isLoggedIn(): boolean {
  return fs.existsSync(CERT_FILE);
}

// -------------------------------
// Command: login
// -------------------------------
program
  .command("login")
  .description(
    "Authenticate with your Cloudflare account (cloudflared tunnel login)."
  )
  .option("-f, --force", "Force login even if cert.pem already exists")
  .action(async (options: { force?: boolean }) => {
    // First check if cloudflared is installed
    if (!checkCloudflaredInstalled()) {
      console.error(
        chalk.red("Error: cloudflared is not installed or not in the PATH.")
      );
      console.log(
        chalk.yellow(
          "Please install cloudflared using one of the following methods:"
        )
      );
      console.log(
        chalk.cyan("  macOS: brew install cloudflare/cloudflare/cloudflared")
      );
      console.log(chalk.cyan("  Windows: choco install cloudflared"));
      console.log(
        chalk.cyan(
          "  Linux: See https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation"
        )
      );
      process.exit(1);
    }

    // Check if cert already exists
    if (isLoggedIn() && !options.force) {
      const answers = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: `A Cloudflare certificate already exists at ${CERT_FILE}. Overwrite it?`,
          default: false,
        },
      ]);

      if (!answers.overwrite) {
        console.log(chalk.yellow("Login aborted. Use existing certificate."));
        return;
      }
      // Delete the existing cert if user wants to overwrite
      fs.removeSync(CERT_FILE);
    }

    try {
      console.log(chalk.cyan("Opening browser to login with Cloudflare..."));
      execSync("cloudflared tunnel login", { stdio: "inherit" });

      // Verify that login was actually successful by checking for cert.pem
      if (isLoggedIn()) {
        console.log(
          chalk.green("Login complete! Certificate successfully created.")
        );
      } else {
        console.error(
          chalk.red("Login may have failed. Certificate not found at: ") +
            chalk.yellow(CERT_FILE)
        );
        process.exit(1);
      }
    } catch (err) {
      // Check specific error patterns
      const errorMsg = String(err);
      if (errorMsg.includes("existing certificate")) {
        console.error(
          chalk.red(
            "Error: There's an existing certificate that needs to be handled."
          )
        );
        console.log(
          chalk.yellow(`You can either:
  1. Remove the certificate manually: rm ${CERT_FILE}
  2. Run the command with --force flag: askhoku login --force`)
        );
      } else {
        console.error(
          chalk.red("Error running `cloudflared tunnel login`: "),
          err
        );
      }
      process.exit(1);
    }
  });

// -------------------------------
// Command: init
// -------------------------------
program
  .command("init")
  .description("Initialize a new Cloudflare Tunnel (or use an existing one).")
  .option(
    "-u, --use-existing",
    "Use an existing tunnel by ID instead of creating a new one"
  )
  .option(
    "-f, --force",
    "Force creation of a new tunnel even if one exists in config"
  )
  .action(async (options: { useExisting?: boolean; force?: boolean }) => {
    // First check if cloudflared is installed
    if (!checkCloudflaredInstalled()) {
      console.error(
        chalk.red("Error: cloudflared is not installed or not in the PATH.")
      );
      console.log(
        chalk.yellow(
          "Please install cloudflared first. Run 'askhoku login' for installation instructions."
        )
      );
      process.exit(1);
    }

    // Check if the user is logged in
    if (!isLoggedIn()) {
      console.error(
        chalk.red("Error: You need to log in to Cloudflare first.")
      );
      console.log(
        chalk.yellow("Please run 'askhoku login' before initializing a tunnel.")
      );
      process.exit(1);
    }

    let config = loadConfig();

    if (config.tunnelId && !options.force && !options.useExisting) {
      console.log(
        chalk.yellow(
          "A tunnel is already initialized in your config. Current tunnel:"
        )
      );
      console.log(`Tunnel Name: ${chalk.cyan(config.tunnelName)}`);
      console.log(`Tunnel ID:   ${chalk.cyan(config.tunnelId)}`);

      const answers = await inquirer.prompt([
        {
          type: "confirm",
          name: "keepExisting",
          message: "Do you want to keep using this tunnel?",
          default: true,
        },
      ]);

      if (answers.keepExisting) {
        console.log(chalk.green("Continuing with existing tunnel."));
        return;
      } else {
        console.log(chalk.cyan("Creating a new tunnel instead..."));
      }
    }

    // Handle --use-existing option
    if (options.useExisting) {
      const existingTunnels: {
        name: string;
        value: { id: string; name: string };
      }[] = [];
      try {
        const output = execSync(
          "cloudflared tunnel list --output json"
        ).toString();
        const tunnels: Tunnel[] = JSON.parse(output);

        if (tunnels.length === 0) {
          console.log(
            chalk.yellow(
              "No existing tunnels found in your Cloudflare account."
            )
          );
          console.log(
            chalk.cyan("Would you like to create a new tunnel instead?")
          );

          const answers = await inquirer.prompt([
            {
              type: "confirm",
              name: "createNew",
              message: "Create a new tunnel?",
              default: true,
            },
          ]);

          if (!answers.createNew) {
            return;
          }
          // If they want to create a new one, continue to the tunnel creation flow below
        } else {
          // Format tunnels for selection
          tunnels.forEach((tunnel) => {
            existingTunnels.push({
              name: `${tunnel.name} (${tunnel.id})`,
              value: { id: tunnel.id, name: tunnel.name },
            });
          });

          interface TunnelSelection {
            tunnel: { id: string; name: string };
          }

          const answer = await inquirer.prompt<TunnelSelection>([
            {
              type: "list",
              name: "tunnel",
              message: "Select an existing tunnel to use:",
              choices: existingTunnels,
            },
          ]);

          config.tunnelName = answer.tunnel.name;
          config.tunnelId = answer.tunnel.id;
          saveConfig(config);
          console.log(
            chalk.green(
              `Now using tunnel: ${config.tunnelName} (ID: ${config.tunnelId})`
            )
          );
          return;
        }
      } catch (err) {
        console.error(chalk.red("Error listing existing tunnels:"), err);
        console.log(chalk.yellow("Falling back to creating a new tunnel..."));
      }
    }

    // Prompt user for a tunnel name for new tunnel creation
    interface TunnelNamePrompt {
      tunnelName: string;
    }

    const answers = await inquirer.prompt<TunnelNamePrompt>([
      {
        type: "input",
        name: "tunnelName",
        message: "Enter a name for your new Cloudflare Tunnel:",
        validate: (input) => !!input || "Tunnel name cannot be empty.",
      },
    ]);

    const tunnelName = answers.tunnelName.trim();
    try {
      console.log(chalk.cyan(`Creating new tunnel: ${tunnelName}...`));
      // Creates a new tunnel and prints a JSON file at ~/.cloudflared/<TUNNEL-ID>.json
      const output = execSync(
        `cloudflared tunnel create ${tunnelName}`
      ).toString();
      /*
       * Example output to parse for TUNNEL-ID:
       *
       *  Created tunnel my-tunnel with id 12345678-abcd-efgh-ijkl-9876543210ab
       *  Credentials file /Users/username/.cloudflared/12345678-abcd-efgh-ijkl-9876543210ab.json
       */
      const match = output.match(/Created tunnel .* with id ([a-f0-9-]+)/i);
      if (match && match[1]) {
        config.tunnelName = tunnelName;
        config.tunnelId = match[1];
        saveConfig(config);
        console.log(
          chalk.green(`Tunnel created successfully! ID: ${config.tunnelId}`)
        );
        console.log(
          chalk.cyan(
            "Next step: Add services to your tunnel with 'askhoku add-service'"
          )
        );
      } else {
        console.error(
          chalk.red("Unable to parse tunnel ID from the command output.")
        );
        console.log(chalk.yellow("Command output:"));
        console.log(output);
      }
    } catch (err) {
      console.error(
        chalk.red("Error running `cloudflared tunnel create`: "),
        err
      );

      // Check for specific error patterns
      const errorMsg = String(err);
      if (errorMsg.includes("already exists")) {
        console.log(
          chalk.yellow(
            "A tunnel with this name already exists. Try using a different name."
          )
        );
      }

      process.exit(1);
    }
  });

// -------------------------------
// Command: add-service
// -------------------------------
program
  .command("add-service")
  .description(
    "Add a new service (subdomain + local port) to the Cloudflare tunnel config."
  )
  .action(async () => {
    // First check if cloudflared is installed
    if (!checkCloudflaredInstalled()) {
      console.error(
        chalk.red("Error: cloudflared is not installed or not in the PATH.")
      );
      console.log(
        chalk.yellow(
          "Please install cloudflared first. Run 'askhoku login' for installation instructions."
        )
      );
      process.exit(1);
    }

    // Check if the user is logged in
    if (!isLoggedIn()) {
      console.error(
        chalk.red("Error: You need to log in to Cloudflare first.")
      );
      console.log(
        chalk.yellow("Please run 'askhoku login' before adding services.")
      );
      process.exit(1);
    }

    let config = loadConfig();
    if (!config.tunnelId) {
      console.log(
        chalk.red("No tunnel found in config. Please run `askhoku init` first.")
      );
      return;
    }

    // If no services yet, give a more descriptive intro
    if (config.services.length === 0) {
      console.log(
        chalk.cyan("You're adding your first service to the tunnel!")
      );
      console.log(chalk.cyan("Each service maps a hostname to a local port."));
      console.log(
        chalk.cyan("For example: 'app.yourdomain.com' → 'localhost:3000'\n")
      );
    }

    interface ServicePrompt {
      hostname: string;
      port: string;
      protocol: "http" | "https";
    }

    const answers = await inquirer.prompt<ServicePrompt>([
      {
        type: "input",
        name: "hostname",
        message:
          "Enter the full hostname (e.g., service.example.com) for this service:",
        validate: (input) => {
          if (!input) return "Hostname cannot be empty.";
          // Basic hostname validation
          const hostnameRegex =
            /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
          if (!hostnameRegex.test(input)) {
            return "Please enter a valid hostname (e.g., service.example.com)";
          }
          // Check if hostname already exists in config
          if (config.services.some((s) => s.hostname === input)) {
            return "This hostname is already configured. Please use a different one.";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "port",
        message: "Local port that this service is running on (e.g., 3000):",
        validate: (input) => {
          const portNum = parseInt(input, 10);
          if (isNaN(portNum) || portNum <= 0 || portNum >= 65536) {
            return "Port must be a valid number between 1 and 65535.";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "protocol",
        message: "Select the protocol for this service:",
        choices: [
          { name: "HTTP", value: "http" },
          { name: "HTTPS", value: "https" },
        ],
        default: "http",
      },
    ]);

    const { hostname, port, protocol } = answers;

    // 1. Update local config
    const newService: Service = {
      hostname,
      service: `${protocol}://localhost:${port}`,
      createdAt: new Date().toISOString(),
    };
    config.services.push(newService);
    saveConfig(config);
    console.log(
      chalk.green(
        `Service added to local config: ${hostname} -> ${protocol}://localhost:${port}`
      )
    );

    // 2. Create DNS route in Cloudflare
    try {
      console.log(chalk.cyan(`Creating DNS route for ${hostname}...`));
      execSync(`cloudflared tunnel route dns ${config.tunnelId} ${hostname}`, {
        stdio: "inherit",
      } as ExecSyncOptions);
      console.log(chalk.green(`DNS route created for ${hostname}.`));
      console.log(
        chalk.cyan("Note: DNS propagation may take a few minutes to complete.")
      );
    } catch (err) {
      console.error(chalk.red("Error creating DNS route:"), err);

      // Check specific error patterns
      const errorMsg = String(err);
      if (errorMsg.includes("already exists")) {
        console.log(
          chalk.yellow(
            "Note: This hostname might already have a DNS record. If you continue, it will be updated to point to your tunnel."
          )
        );
      } else if (errorMsg.includes("unauthorized")) {
        console.log(
          chalk.yellow(
            "It seems like you may not have permission to modify DNS for this domain. Please check your Cloudflare account permissions."
          )
        );
      }
    }

    // Show next steps
    console.log(chalk.cyan("\nNext steps:"));
    console.log(chalk.cyan("1. Start your service locally on port " + port));
    console.log(chalk.cyan("2. Run 'askhoku run' to start the tunnel"));
    console.log(chalk.cyan("3. Access your service at https://" + hostname));
  });

// -------------------------------
// Command: list-services
// -------------------------------
program
  .command("list-services")
  .description("List services configured for your tunnel.")
  .option("-j, --json", "Output in JSON format")
  .action((options: { json?: boolean }) => {
    // First check if cloudflared is installed
    if (!checkCloudflaredInstalled()) {
      console.error(
        chalk.red("Error: cloudflared is not installed or not in the PATH.")
      );
      console.log(
        chalk.yellow(
          "Please install cloudflared first. Run 'askhoku login' for installation instructions."
        )
      );
      process.exit(1);
    }

    const config = loadConfig();
    if (!config.tunnelId) {
      console.log(
        chalk.yellow(
          "No tunnel configured. Please run `askhoku init` first to set up a tunnel."
        )
      );
      return;
    }

    if (!config.services || config.services.length === 0) {
      console.log(
        chalk.yellow(
          "No services found for your tunnel. Add one with `askhoku add-service`."
        )
      );
      return;
    }

    // JSON output if requested
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            tunnel: {
              name: config.tunnelName,
              id: config.tunnelId,
            },
            services: config.services,
          },
          null,
          2
        )
      );
      return;
    }

    // Normal formatted output
    console.log(
      chalk.cyan(`Tunnel: ${config.tunnelName} (ID: ${config.tunnelId})`)
    );
    console.log(chalk.cyan(`Total services: ${config.services.length}`));
    console.log(chalk.magenta("\nServices:"));

    // Sort services by hostname for easier viewing
    const sortedServices = [...config.services].sort((a, b) =>
      a.hostname.localeCompare(b.hostname)
    );

    sortedServices.forEach((srv, idx) => {
      console.log(
        `  ${chalk.green(idx + 1)}. ${chalk.bold(srv.hostname)} → ${chalk.cyan(
          srv.service
        )}`
      );
      if (srv.createdAt) {
        console.log(`     Added: ${new Date(srv.createdAt).toLocaleString()}`);
      }
    });

    console.log(
      chalk.cyan("\nTo run your tunnel with these services: ") +
        chalk.yellow("askhoku run")
    );
  });

// -------------------------------
// Command: run
// -------------------------------
program
  .command("run")
  .description("Run the tunnel (foreground). Ctrl+C to stop.")
  .option("-d, --detach", "Run the tunnel in the background (detached mode)")
  .action(async (options: { detach?: boolean }) => {
    // First check if cloudflared is installed
    if (!checkCloudflaredInstalled()) {
      console.error(
        chalk.red("Error: cloudflared is not installed or not in the PATH.")
      );
      console.log(
        chalk.yellow(
          "Please install cloudflared first. Run 'askhoku login' for installation instructions."
        )
      );
      process.exit(1);
    }

    // Check if the user is logged in
    if (!isLoggedIn()) {
      console.error(
        chalk.red("Error: You need to log in to Cloudflare first.")
      );
      console.log(
        chalk.yellow("Please run 'askhoku login' before running a tunnel.")
      );
      process.exit(1);
    }

    const config = loadConfig();
    if (!config.tunnelId) {
      console.log(
        chalk.red("No tunnel found in config. Please run `askhoku init` first.")
      );
      return;
    }

    // Check if there are any services
    if (!config.services || config.services.length === 0) {
      console.log(
        chalk.yellow(
          "Warning: You don't have any services configured for this tunnel."
        )
      );
      console.log(
        chalk.yellow(
          "The tunnel will run but won't route any traffic. Add services with 'askhoku add-service'."
        )
      );

      interface ProceedPrompt {
        proceed: boolean;
      }

      const answers = await inquirer.prompt<ProceedPrompt>([
        {
          type: "confirm",
          name: "proceed",
          message:
            "Do you want to continue running the tunnel without any services?",
          default: false,
        },
      ]);

      if (!answers.proceed) {
        console.log(
          chalk.cyan(
            "Tunnel startup cancelled. Add services first with 'askhoku add-service'."
          )
        );
        return;
      }
    }

    // Generate a config file for cloudflared
    const configYamlPath = path.join(CONFIG_DIR, `${config.tunnelId}.yml`);
    try {
      // Create ingress rules for all services
      const ingressRules: Array<{ hostname?: string; service: string }> =
        config.services.map((service) => ({
          hostname: service.hostname,
          service: service.service,
        }));

      // Add catch-all rule at the end
      ingressRules.push({
        service: "http_status:404",
      });

      const cloudflaredConfig = {
        tunnel: config.tunnelId,
        credentials: path.join(CONFIG_DIR, `${config.tunnelId}.json`),
        ingress: ingressRules,
      };

      // Write the YAML config
      fs.writeFileSync(configYamlPath, YAML.stringify(cloudflaredConfig));
      console.log(chalk.green(`Generated config file at ${configYamlPath}`));
    } catch (err) {
      console.error(chalk.red("Error generating config file:"), err);
      console.log(
        chalk.yellow("Falling back to running tunnel without a config file...")
      );
    }

    console.log(
      chalk.cyan(
        `Starting tunnel: ${config.tunnelName} (ID: ${config.tunnelId})...`
      )
    );

    if (config.services && config.services.length > 0) {
      console.log(chalk.green("The following services will be available:"));
      config.services.forEach((srv) => {
        console.log(
          `  - https://${chalk.bold(srv.hostname)} → ${chalk.cyan(srv.service)}`
        );
      });
    }

    try {
      const runCommand = fs.existsSync(configYamlPath)
        ? `cloudflared tunnel --config ${configYamlPath} run`
        : `cloudflared tunnel run ${config.tunnelId}`;

      console.log(chalk.cyan("Starting tunnel with command:"));
      console.log(chalk.yellow(`  ${runCommand}`));

      if (options.detach) {
        // Run in background mode
        console.log(chalk.cyan("Running in background mode..."));
        const detachedProcess = exec(runCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
          }
          console.log(`stdout: ${stdout}`);
        });

        // Don't wait for the process and let it run in background
        detachedProcess.unref();

        console.log(chalk.green("Tunnel is now running in the background."));
        console.log(
          chalk.yellow("Note: You'll need to manually stop the process later.")
        );
      } else {
        // Run in foreground mode
        console.log(
          chalk.cyan("Running in foreground mode. Press Ctrl+C to stop.")
        );
        execSync(runCommand, {
          stdio: "inherit",
        } as ExecSyncOptions);
      }
    } catch (err) {
      // Only treat as error if we're not in detached mode (where Ctrl+C is normal)
      if (!options.detach) {
        console.error(chalk.red("Error running tunnel:"), err);

        // Check for specific error messages
        const errorMsg = String(err);
        if (errorMsg.includes("already running")) {
          console.log(
            chalk.yellow(
              "It looks like this tunnel is already running in another process."
            )
          );
          console.log(
            chalk.yellow(
              "You may need to stop that process first or use a different tunnel."
            )
          );
        } else if (errorMsg.includes("not found")) {
          console.log(
            chalk.yellow(
              "The tunnel ID may not exist or may have been deleted."
            )
          );
          console.log(
            chalk.yellow("Try running 'askhoku init' to create a new tunnel.")
          );
        } else if (errorMsg.includes("credentials")) {
          console.log(
            chalk.yellow(
              "Credentials file may be missing. Try re-creating the tunnel with 'askhoku init'."
            )
          );
        }
      }
    }
  });

// -------------------------------
// Command: version
// -------------------------------
program
  .command("version")
  .description("Show the CLI version")
  .action(() => {
    // Using require for package.json since it's a direct sibling to this file at runtime
    const packageJson = require("../package.json");
    console.log(`askhoku-cli version: ${chalk.green(packageJson.version)}`);

    try {
      const cloudflaredVersion = execSync("cloudflared --version")
        .toString()
        .trim();
      console.log(`cloudflared version: ${chalk.green(cloudflaredVersion)}`);
    } catch (err) {
      console.log(`cloudflared: ${chalk.red("Not installed or not in PATH")}`);
    }
  });

// -------------------------------
// Command: stop
// -------------------------------
program
  .command("stop")
  .description("Stop a running tunnel")
  .option("-f, --force", "Force kill the tunnel process")
  .action(async (options: { force?: boolean }) => {
    // First check if cloudflared is installed
    if (!checkCloudflaredInstalled()) {
      console.error(
        chalk.red("Error: cloudflared is not installed or not in the PATH.")
      );
      console.log(
        chalk.yellow(
          "Please install cloudflared first. Run 'askhoku login' for installation instructions."
        )
      );
      process.exit(1);
    }

    const config = loadConfig();
    if (!config.tunnelId) {
      console.log(
        chalk.red("No tunnel found in config. Please run `askhoku init` first.")
      );
      return;
    }

    console.log(
      chalk.cyan(
        `Looking for running tunnel: ${config.tunnelName} (ID: ${config.tunnelId})...`
      )
    );

    try {
      // Get the list of running processes that match cloudflared and our tunnel ID
      let command: string;
      let processInfo: string;

      if (process.platform === "win32") {
        // Windows
        command = `tasklist /FI "IMAGENAME eq cloudflared.exe" /FO CSV`;
        processInfo = execSync(command).toString();

        if (!processInfo.includes("cloudflared.exe")) {
          console.log(chalk.yellow("No running tunnel process found."));
          return;
        }
      } else {
        // Unix-like (macOS, Linux)
        command = `ps aux | grep "cloudflared tunnel.*${config.tunnelId}" | grep -v grep`;
        try {
          processInfo = execSync(command).toString();
        } catch (err) {
          // If the grep command returns nothing, it will exit with code 1
          console.log(chalk.yellow("No running tunnel process found."));
          return;
        }
      }

      // Extract PID from the process info
      let pid: string | undefined;

      if (process.platform === "win32") {
        // Windows CSV format: "Image Name","PID",...
        const matches = processInfo.match(/"cloudflared\.exe","\d+"/);
        if (matches && matches[0]) {
          pid = matches[0].split('"')[3];
        }
      } else {
        // Unix-like format: user PID %CPU...
        const lines = processInfo
          .split("\n")
          .filter((line) => line.trim() !== "");
        if (lines.length > 0) {
          const parts = lines[0].split(/\s+/);
          if (parts.length > 1) {
            pid = parts[1];
          }
        }
      }

      if (!pid) {
        console.log(chalk.yellow("Couldn't identify the tunnel process ID."));
        return;
      }

      // Confirm with the user before killing
      if (!options.force) {
        const answers = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: `Found tunnel process (PID: ${pid}). Stop it?`,
            default: true,
          },
        ]);

        if (!answers.confirm) {
          console.log(chalk.yellow("Operation cancelled."));
          return;
        }
      }

      // Kill the process
      console.log(chalk.cyan(`Stopping tunnel process (PID: ${pid})...`));

      if (process.platform === "win32") {
        execSync(`taskkill ${options.force ? "/F" : ""} /PID ${pid}`);
      } else {
        execSync(`kill ${options.force ? "-9" : ""} ${pid}`);
      }

      console.log(chalk.green(`Tunnel stopped successfully.`));

      // Try to verify the process is really gone
      setTimeout(() => {
        try {
          if (process.platform === "win32") {
            execSync(`tasklist /FI "PID eq ${pid}" /FO CSV`);
            console.log(
              chalk.yellow(
                "Warning: The process may still be running. You might need to use --force option."
              )
            );
          } else {
            execSync(`ps -p ${pid}`);
            console.log(
              chalk.yellow(
                "Warning: The process may still be running. You might need to use --force option."
              )
            );
          }
        } catch (err) {
          // If the process is gone, the command will fail, which is good
          console.log(chalk.green("Verified process is no longer running."));
        }
      }, 500);
    } catch (err) {
      console.error(chalk.red("Error stopping tunnel:"), err);
      if (options.force) {
        console.log(
          chalk.yellow(
            "You used --force but the operation still failed. The tunnel might not be running or you might need elevated permissions."
          )
        );
      } else {
        console.log(
          chalk.yellow("Try using the --force option: askhoku stop --force")
        );
      }
    }
  });

// -------------------------------
// Command: remove-service
// -------------------------------
program
  .command("remove-service")
  .description("Remove a service from the tunnel configuration")
  .option("-f, --force", "Skip confirmation prompt")
  .option("-d, --delete-dns", "Also delete the DNS CNAME record in Cloudflare")
  .action(async (options: { force?: boolean; deleteDns?: boolean }) => {
    // First check if cloudflared is installed
    if (!checkCloudflaredInstalled()) {
      console.error(
        chalk.red("Error: cloudflared is not installed or not in the PATH.")
      );
      console.log(
        chalk.yellow(
          "Please install cloudflared first. Run 'askhoku login' for installation instructions."
        )
      );
      process.exit(1);
    }

    const config = loadConfig();
    if (!config.tunnelId) {
      console.log(
        chalk.red("No tunnel found in config. Please run `askhoku init` first.")
      );
      return;
    }

    if (!config.services || config.services.length === 0) {
      console.log(
        chalk.yellow(
          "No services found for your tunnel. Add one with `askhoku add-service`."
        )
      );
      return;
    }

    // Create a list of services for the user to choose from
    const choices = config.services.map((service, index) => ({
      name: `${index + 1}. ${service.hostname} → ${service.service}`,
      value: index,
    }));

    interface ServiceSelection {
      serviceIndex: number;
    }

    // Let the user select which service to remove
    const answer = await inquirer.prompt<ServiceSelection>([
      {
        type: "list",
        name: "serviceIndex",
        message: "Select the service you want to remove:",
        choices,
      },
    ]);

    const selectedIndex = answer.serviceIndex;
    const selectedService = config.services[selectedIndex];

    // Confirm removal
    if (!options.force) {
      const confirmAnswer = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: `Are you sure you want to remove ${chalk.bold(
            selectedService.hostname
          )}?`,
          default: false,
        },
      ]);

      if (!confirmAnswer.confirm) {
        console.log(chalk.yellow("Operation cancelled."));
        return;
      }
    }

    try {
      // Remove the service from the configuration
      config.services.splice(selectedIndex, 1);
      saveConfig(config);

      console.log(
        chalk.green(
          `Service ${chalk.bold(
            selectedService.hostname
          )} has been removed from the tunnel configuration.`
        )
      );

      // Delete DNS record if requested
      if (options.deleteDns) {
        console.log(
          chalk.cyan(
            `Attempting to delete DNS record for ${selectedService.hostname}...`
          )
        );

        try {
          // Unfortunately, cloudflared CLI doesn't provide a direct command to delete DNS records
          // So we'll provide guidance for the user to do it manually
          console.log(
            chalk.yellow(
              "Cloudflared CLI doesn't provide a direct command to delete DNS records."
            )
          );
          console.log(
            chalk.yellow(
              "Please delete the DNS record manually from your Cloudflare dashboard:"
            )
          );
          console.log(chalk.yellow("1. Log in to your Cloudflare account"));
          console.log(
            chalk.yellow("2. Select the domain and go to the DNS tab")
          );
          console.log(
            chalk.yellow(
              `3. Find the CNAME record for ${selectedService.hostname} and delete it`
            )
          );
        } catch (dnsErr) {
          console.error(chalk.red("Error:"), dnsErr);
        }
      } else {
        // Note about DNS
        console.log(
          chalk.yellow(
            "Note: This only removes the service from your local tunnel configuration."
          )
        );
        console.log(
          chalk.yellow(
            "The DNS record in Cloudflare still exists. To remove it, use '--delete-dns' next time or delete it from the Cloudflare dashboard."
          )
        );
      }

      // If this was the last service, suggest what to do
      if (config.services.length === 0) {
        console.log(
          chalk.cyan(
            "There are no more services configured for this tunnel. You can:"
          )
        );
        console.log(
          chalk.cyan("1. Add new services with 'askhoku add-service'")
        );
        console.log(
          chalk.cyan(
            "2. Delete the tunnel completely from Cloudflare if no longer needed"
          )
        );
      } else {
        console.log(
          chalk.cyan(`Remaining services: ${config.services.length}`)
        );
        console.log(
          chalk.cyan(
            "You will need to restart your tunnel for changes to take effect:"
          )
        );
        console.log(chalk.cyan("1. Stop the tunnel: askhoku stop"));
        console.log(chalk.cyan("2. Start it again: askhoku run"));
      }
    } catch (err) {
      console.error(chalk.red("Error removing service:"), err);
      process.exit(1);
    }
  });

// Parse the command line arguments
program.parse(process.argv);
