import fs from "fs";
import path from "path";

export type LogLevel =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "ALERT"
  | "AUDITORIA";

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

const LOGS_DIR = path.resolve(__dirname, "../../logs");

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function formatTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export { formatTimestamp };

function formatConsoleLine(log: StructuredLog): string {
  const header = `[${log.timestamp}] [${log.level}] [${log.module}] ${log.message}`;
  if (!log.details || Object.keys(log.details).length === 0) {
    return header;
  }

  const detailLines = Object.entries(log.details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const formattedValue = Array.isArray(value) ? value.join(", ") : value;
      return `  ├─ ${key}: ${formattedValue}`;
    });

  if (detailLines.length > 0) {
    const last = detailLines.pop()!;
    detailLines.push(last.replace("├─", "└─"));
  }

  return [header, ...detailLines].join("\n");
}

function appendToFile(filename: string, line: string): void {
  ensureLogsDir();
  fs.appendFileSync(path.join(LOGS_DIR, filename), `${line}\n`, "utf-8");
}

function resolveLogFiles(level: LogLevel): string[] {
  const files = ["app.log"];

  if (level === "ERROR" || level === "ALERT") {
    files.push("erros.log");
  }

  if (level === "AUDITORIA" || level === "WARNING" || level === "ERROR") {
    files.push("auditoria.log");
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
      details,
    };

    const formatted = formatConsoleLine(entry);
    console.log(formatted);

    for (const file of resolveLogFiles(level)) {
      appendToFile(file, formatted);
    }

    return entry;
  }

  info(module: string, message: string, details?: LogDetails): StructuredLog {
    return this.log("INFO", module, message, details);
  }

  success(
    module: string,
    message: string,
    details?: LogDetails
  ): StructuredLog {
    return this.log("SUCCESS", module, message, details);
  }

  warning(
    module: string,
    message: string,
    details?: LogDetails
  ): StructuredLog {
    return this.log("WARNING", module, message, details);
  }

  error(module: string, message: string, details?: LogDetails): StructuredLog {
    return this.log("ERROR", module, message, details);
  }

  alert(module: string, message: string, details?: LogDetails): StructuredLog {
    return this.log("ALERT", module, message, details);
  }

  auditoria(
    module: string,
    message: string,
    details?: LogDetails
  ): StructuredLog {
    return this.log("AUDITORIA", module, message, details);
  }
}

export const logger = new Logger();
