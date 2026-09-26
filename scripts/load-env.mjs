import { readFileSync } from "node:fs";

export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(file, "utf8");
      for (const line of text.split("\n")) {
        const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
        if (!match) continue;
        const value = match[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[match[1]]) process.env[match[1]] = value;
      }
    } catch {
      // Missing env files are fine.
    }
  }
}
