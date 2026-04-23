import { Command } from "commander";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import YAML from "yaml";
import { parseFlowYaml } from "@openhop/shared";

/** Read input from file path or stdin (use "-" for stdin) */
function readInput(file: string): string {
  if (file === "-") {
    return readFileSync(0, "utf-8"); // fd 0 = stdin
  }
  return readFileSync(resolve(file), "utf-8");
}

// ANSI color helpers
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

const DEFAULT_SERVER = "http://localhost:8787";

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

const program = new Command();

program
  .name("openhop")
  .description("OpenHop — Data Flow Visualization CLI")
  .version("0.0.1");

// --- serve ---
program
  .command("serve")
  .description("Start the OpenHop server")
  .option("-p, --port <port>", "Port to listen on", "8787")
  .action((opts) => {
    const serverEntry = resolve(
      import.meta.dirname,
      "../../server/src/index.ts"
    );
    console.log(dim(`Starting OpenHop server on port ${opts.port}...`));
    const child = spawn("npx", ["tsx", serverEntry], {
      stdio: "inherit",
      env: { ...process.env, PORT: opts.port },
    });
    child.on("error", (err) => {
      console.error(red(`Failed to start server: ${err.message}`));
      process.exit(1);
    });
    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });
  });

// --- push ---
program
  .command("push <file>")
  .description("Push a YAML flow to the server (use - for stdin)")
  .option("-s, --server <url>", "Server URL", DEFAULT_SERVER)
  .action(async (file: string, opts) => {
    const yamlContent = readInput(file);

    // Validate locally first
    const result = parseFlowYaml(yamlContent);
    if (!result.success) {
      console.error(red("✗ Validation errors:"));
      for (const err of result.errors) {
        const suggestion = err.suggestion ? ` ${err.suggestion}` : "";
        console.error(`  ${dim(err.path + ":")} ${err.message}${suggestion}`);
      }
      process.exit(1);
    }

    try {
      const res = await fetch(`${opts.server}/api/flows`, {
        method: "POST",
        headers: { "Content-Type": "text/yaml" },
        body: yamlContent,
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(red(`✗ Server error (${res.status}): ${body}`));
        process.exit(1);
      }

      const data = await res.json() as { id: string; title: string; version: number };
      const webUrl = opts.server.replace(/:\d+$/, ":8788");
      console.log(green("✓ Flow created"));
      console.log(`  ${bold("ID:")}    ${data.id}`);
      console.log(`  ${bold("Title:")} ${data.title}`);
      console.log(`  ${bold("URL:")}   ${cyan(`${webUrl}/flow/${data.id}`)}`);
    } catch (err: any) {
      console.error(red(`✗ Connection failed: ${err.message}`));
      process.exit(1);
    }
  });

// --- list ---
program
  .command("list")
  .description("List all flows on the server")
  .option("-s, --server <url>", "Server URL", DEFAULT_SERVER)
  .action(async (opts) => {
    try {
      const res = await fetch(`${opts.server}/api/flows`);
      if (!res.ok) {
        console.error(red(`✗ Server error (${res.status})`));
        process.exit(1);
      }

      const flows = await res.json() as Array<{
        id: string;
        title: string;
        path?: string;
        version: number;
        updatedAt: string;
      }>;

      if (flows.length === 0) {
        console.log(dim("No flows found."));
        return;
      }

      // Print table header
      const cols = [
        { key: "id", label: "ID", width: 16 },
        { key: "title", label: "Title", width: 16 },
        { key: "path", label: "Path", width: 22 },
        { key: "version", label: "Version", width: 9 },
        { key: "updatedAt", label: "Updated", width: 12 },
      ] as const;

      const header = cols.map((c) => bold(padRight(c.label, c.width))).join("");
      console.log(header);

      for (const flow of flows) {
        const date = flow.updatedAt
          ? new Date(flow.updatedAt).toISOString().slice(0, 10)
          : "";
        const row = [
          padRight(flow.id, 16),
          padRight(flow.title || "", 16),
          padRight(flow.path || "", 22),
          padRight(`v${flow.version}`, 9),
          padRight(date, 12),
        ].join("");
        console.log(row);
      }
    } catch (err: any) {
      console.error(red(`✗ Connection failed: ${err.message}`));
      process.exit(1);
    }
  });

// --- patch ---
program
  .command("patch <flow-id> <file>")
  .description("Patch a flow with operations from a YAML file")
  .option("-s, --server <url>", "Server URL", DEFAULT_SERVER)
  .action(async (flowId: string, file: string, opts) => {
    const content = readInput(file);

    // Parse YAML
    let operations: unknown;
    try {
      operations = YAML.parse(content);
    } catch (err: any) {
      console.error(red(`✗ Parse error: ${err.message}`));
      process.exit(1);
    }

    // Validate patch schema locally
    const { patchSchema } = await import("@openhop/shared");
    const validation = patchSchema.safeParse(operations);
    if (!validation.success) {
      console.error(red("✗ Validation errors:"));
      for (const issue of validation.error.issues) {
        console.error(`  ${dim(issue.path.join(".") + ":")} ${issue.message}`);
      }
      process.exit(1);
    }

    try {
      const res = await fetch(`${opts.server}/api/flows/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operations),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(red(`✗ Server error (${res.status}): ${body}`));
        process.exit(1);
      }

      const data = await res.json() as { id: string; title: string; version: number };
      console.log(green("✓ Flow patched"));
      console.log(`  ${bold("ID:")}      ${data.id}`);
      console.log(`  ${bold("Title:")}   ${data.title}`);
      console.log(`  ${bold("Version:")} v${data.version}`);
    } catch (err: any) {
      console.error(red(`✗ Connection failed: ${err.message}`));
      process.exit(1);
    }
  });

// --- remove ---
program
  .command("remove <flow-id>")
  .description("Delete a flow from the server")
  .option("-s, --server <url>", "Server URL", DEFAULT_SERVER)
  .action(async (flowId: string, opts) => {
    try {
      const res = await fetch(`${opts.server}/api/flows/${flowId}`, {
        method: "DELETE",
      });

      if (res.status === 204) {
        console.log(green("✓ Flow deleted"));
        console.log(`  ${bold("ID:")} ${flowId}`);
      } else if (res.status === 404) {
        console.error(red(`✗ Flow "${flowId}" not found`));
        process.exit(1);
      } else {
        const body = await res.text();
        console.error(red(`✗ Server error (${res.status}): ${body}`));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(red(`✗ Connection failed: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
