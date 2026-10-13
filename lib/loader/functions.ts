import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import type { EnvCollection, EnvRecord, LoadOptions } from "@loader/defs";
import { EnvironmentParser, LazyEnvironmentParser } from "@loader/parser";

// constants
const IS_BUN: boolean = typeof Bun !== "undefined";
const ENVIRONMENT = IS_BUN ? Bun.env : process.env;

let ENVIRONMENT_CACHE: Record<string, string> | null = null;
let ENVIRONMENT_CACHE_KEY: string = "";

/**
 * Determinates whether a filename matches the supported ".env" naming convention.
 * @param name Filename to validate.
 */
export function isEnvironmentFilename(name: string): boolean {
  const filename: string = basename(name);

  // expect '.env' (coldstart)
  if (
    filename.length < 4 ||
    filename.charCodeAt(0) !== 46 || // .
    filename.charCodeAt(1) !== 101 || // e
    filename.charCodeAt(2) !== 110 || // n
    filename.charCodeAt(3) !== 118 // v
  ) {
    return false;
  }

  // is valid '.env.*' name?
  if (filename.length === 4) return true;
  if (filename.charCodeAt(4) !== 46) return false;

  // validate suffix characters
  for (let index: number = 5; index < filename.length; index++) {
    const char: number = filename.charCodeAt(index);
    if (
      !(
        (
          (char >= 48 && char <= 57) || // 0-9
          (char >= 65 && char <= 90) || // A-Z
          (char >= 97 && char <= 122) || // a-z
          char === 45 || // -
          char === 95
        ) // _
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Loads and parses a specified environment file from the filesystem.
 * @param filepath Absolute or relative path to the environment file.
 * @param options Loading behavior configuration.
 */
function loadFile(filepath: string, options: LoadOptions = {}): EnvRecord {
  const filename: string = basename(filepath);
  if (!isEnvironmentFilename(filename)) return {};
  if (!existsSync(filepath)) return {};

  const content: string = readFileSync(filepath, "utf-8");
  return options.optimizationMode === "lazy"
    ? new LazyEnvironmentParser(content).parseLazy()
    : new EnvironmentParser(content).parse();
}

/**
 * Loads, parses, and applies a resolved environment file.
 * @param filepath Absolute path to the environment file.
 * @param options Loading behavior configuration.
 */
export function loadResolvedEnv(
  filepath: string,
  options: LoadOptions = {},
): EnvRecord {
  // return cache if loading the same file
  if (
    !options.ignoreCache &&
    ENVIRONMENT_CACHE &&
    ENVIRONMENT_CACHE_KEY === filepath
  ) {
    return ENVIRONMENT_CACHE;
  }

  // parsing only
  const populateProcessEnv: boolean = options.populateProcessEnv ?? true;
  const parsed: EnvRecord = loadFile(filepath, options);

  if (!populateProcessEnv) {
    const result = Object.freeze({ ...parsed });
    ENVIRONMENT_CACHE_KEY = filepath;
    ENVIRONMENT_CACHE = result;
    return result;
  }

  // nodejs or with bypassBun: inject missing variables only
  if (options.ignoreBun || !IS_BUN) {
    for (const key in parsed) {
      if (!(key in ENVIRONMENT)) {
        ENVIRONMENT[key] = parsed[key];
      }
    }

    ENVIRONMENT_CACHE_KEY = filepath;
    ENVIRONMENT_CACHE = parsed;
    return parsed;
  }

  // on bun: preserve pre-loaded environment variables
  const result: EnvCollection = {};
  for (const key in parsed) {
    const value = parsed[key] ?? "";
    if (key in ENVIRONMENT) {
      result[key] = ENVIRONMENT[key] || value;
    } else {
      ENVIRONMENT[key] = value;
      result[key] = value;
    }
  }

  ENVIRONMENT_CACHE_KEY = filepath;
  ENVIRONMENT_CACHE = result;
  return Object.freeze(result);
}
