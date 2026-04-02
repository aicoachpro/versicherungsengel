import { getSetting } from "@/lib/settings";
import fs from "fs";
import path from "path";

/**
 * Writes a report to the Obsidian vault if configured, otherwise returns null.
 * Returns the file path if written, or null if vault is not configured.
 */
export function writeToVault(filename: string, content: string): string | null {
  const vaultPath = getSetting("obsidian.vaultPath");
  if (!vaultPath) return null;

  const reportFolder = getSetting("obsidian.reportFolder") || "";
  const targetDir = reportFolder
    ? path.join(vaultPath, reportFolder)
    : vaultPath;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}
