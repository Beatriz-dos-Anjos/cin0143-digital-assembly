
import fs from "fs";
import path from "path";

export type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "ALERT" | "AUDITORIA";

export interface LogDetails {
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  details?: LogDetails;
}

const LOGS_DIR = path.resolve(process.env.LOGS_DIR || "logs");
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const LOG_FILES = {
  app: "app.log",
  errors: "erros.log",
  audit: "auditoria.log",
} as const;

export function formatTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function rotateLogIfNeeded(logFilePath: string): void {
  const fileSize = getFileSize(logFilePath);

  if (fileSize >= MAX_LOG_SIZE) {
    const timestamp = formatTimestamp().replace(/[:\s-]/g, "_");
    const ext = path.extname(logFilePath);
    const basename = path.basename(logFilePath, ext);
    const dir = path.dirname(logFilePath);

    const rotatedName = `${basename}.${timestamp}${ext}`;
    const rotatedPath = path.join(dir, rotatedName);

    fs.renameSync(logFilePath, rotatedPath);
  }
}

function formatConsoleLine(log: StructuredLog): string {
  const colors = {
    INFO: "\x1b[36m",   
    SUCCESS: "\x1b[32m", 
    WARNING: "\x1b[33m", 
    ERROR: "\x1b[31m",   
    ALERT: "\x1b[35m", 
    AUDITORIA: "\x1b[34m", 
    RESET: "\x1b[0m",
  };

  const color = colors[log.level] || colors.INFO;
  const header = `${color}[${log.timestamp}] [${log.level}] [${log.module}]${colors.RESET} ${log.message}`;

  if (!log.details || Object.keys(log.details).length === 0) {
    return header;
  }

  const detailLines = Object.entries(log.details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const formattedValue = Array.isArray(value) ? value.join(", ") : String(value);
      return `  ├─ ${key}: ${formattedValue}`;
    });

  if (detailLines.length > 0) {
    detailLines[detailLines.length - 1] = detailLines[detailLines.length - 1]!.replace(
      "├─",
      "└─"
    );
  }

  return [header, ...detailLines].join("\n");
}

function formatFileLine(log: StructuredLog): string {
  const details = log.details ? JSON.stringify(log.details) : "";
  return [
    `timestamp=${log.timestamp}`,
    `level=${log.level}`,
    `module=${log.module}`,
    `message=${log.message}`,
    ...(details ? [`details=${details}`] : []),
  ].join(" | ");
}

function appendToFile(filename: string, line: string): void {
  ensureLogsDir();
  const filePath = path.join(LOGS_DIR, filename);

  try {
    rotateLogIfNeeded(filePath);
    fs.appendFileSync(filePath, `${line}\n`, "utf-8");
  } catch (error) {
    console.error(`Erro ao escrever log em ${filename}:`, error);
  }
}

function resolveLogFiles(level: LogLevel): string[] {
  const files : string[]= [LOG_FILES.app];

  if (level === "ERROR" || level === "ALERT") {
    files.push(LOG_FILES.errors);
  }

  if (level === "AUDITORIA" || level === "WARNING" || level === "ERROR") {
    files.push(LOG_FILES.audit);
  }

  return files;
}

export class Logger {

  log(
    level: LogLevel,
    module: string,
    message: string,
    details?: LogDetails
  ): StructuredLog {
    const entry: StructuredLog = {
      timestamp: formatTimestamp(),
      level,
      module,
      message,
      details: details && Object.keys(details).length > 0 ? details : undefined,
    };

    const formattedConsole = formatConsoleLine(entry);
    console.log(formattedConsole);

    const formattedFile = formatFileLine(entry);
    for (const file of resolveLogFiles(level)) {
      appendToFile(file, formattedFile);
    }

    return entry;
  }

  info(module: string, message: string, details?: LogDetails): StructuredLog {
    return this.log("INFO", module, message, details);
  }

  success(module: string, message: string, details?: LogDetails): StructuredLog {
    return this.log("SUCCESS", module, message, details);
  }

  warning(module: string, message: string, details?: LogDetails): StructuredLog {
    return this.log("WARNING", module, message, details);
  }

  error(module: string, message: string, details?: LogDetails): StructuredLog {
    return this.log("ERROR", module, message, details);
  }

  alert(module: string, message: string, details?: LogDetails): StructuredLog {
    return this.log("ALERT", module, message, details);
  }

  auditoria(module: string, message: string, details?: LogDetails): StructuredLog {
    return this.log("AUDITORIA", module, message, details);
  }
}

export const logger = new Logger();