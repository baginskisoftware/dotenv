import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import type { EnvFile, EnvRecord, LoadOptions } from "@loader/defs";
import { isEnvironmentFilename, loadResolvedEnv } from "@loader/functions";

/**
 * Loads a single environment file.
 * @param file Environment file name.
 * @param options Loading behavior configuration.
 * @returns Frozen record of all loaded environment variables.
 */
export function loadEnv(
  file: EnvFile = ".env",
  options: LoadOptions = {},
): EnvRecord {
  const filepath: string = resolve(options.dir ?? cwd(), file);
  if (!isEnvironmentFilename(filepath)) return {};
  if (!existsSync(filepath)) return {};
  return loadResolvedEnv(filepath, options);
}

/**
 * Loads the first matching environment file from a prioritized list.
 * @param files Priority-ordered array of environment file names.
 * @param options Loading behavior configuration.
 * @returns Frozen record of all loaded environment variables.
 */
export function loadEnvFirst(
  files: EnvFile[] = [".env.local", ".env"],
  options: LoadOptions = {},
): EnvRecord {
  const baseDir: string = options.dir ?? cwd();
  for (const file of files) {
    const filepath: string = resolve(baseDir, file);
    if (!isEnvironmentFilename(filepath)) continue;
    if (!existsSync(filepath)) continue;
    return loadResolvedEnv(filepath, options);
  }
  return {};
}
