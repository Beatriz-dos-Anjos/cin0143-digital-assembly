/**
 * Logger - Sistema de logging estruturado com rotação
 * ✅ Logs estruturados em JSON
 * ✅ Rotação automática de arquivos
 * ✅ Múltiplos níveis
 */

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

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================

const LOGS_DIR = path.resolve(process.env.LOGS_DIR || "logs");
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const LOG_FILES = {
  app: "app.log",
  errors: "erros.log",
  audit: "auditoria.log",
} as const;

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Formata timestamp em formato legível
 * @param date Data a formatar (padrão: agora)
 * @returns String formatada YYYY-MM-DD HH:mm:ss
 */
export function formatTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Garante que o diretório de logs existe
 */
function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Obtém tamanho de um arquivo
 * @param filePath Caminho do arquivo
 * @returns Tamanho em bytes ou 0 se não existe
 */
function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/**
 * Rotaciona um arquivo de log se excedeu o tamanho máximo
 * @param logFilePath Caminho do arquivo de log
 */
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

    // Compactar arquivo rotacionado (opcional)
    // zlib.gzip(fs.readFileSync(rotatedPath), (err, result) => {
    //   if (!err) fs.writeFileSync(rotatedPath + '.gz', result);
    // });
  }
}

/**
 * Formata uma linha de log para console com cores e estrutura
 * @param log Entrada de log estruturada
 * @returns String formatada
 */
function formatConsoleLine(log: StructuredLog): string {
  const colors = {
    INFO: "\x1b[36m",    // Cyan
    SUCCESS: "\x1b[32m", // Green
    WARNING: "\x1b[33m", // Yellow
    ERROR: "\x1b[31m",   // Red
    ALERT: "\x1b[35m",   // Magenta
    AUDITORIA: "\x1b[34m", // Blue
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

/**
 * Formata uma linha de log para arquivo (sem cores)
 * @param log Entrada de log estruturada
 * @returns String formatada para arquivo
 */
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

/**
 * Adiciona uma linha a um arquivo de log
 * @param filename Nome do arquivo
 * @param line Linha a adicionar
 * @param asJson Se deve formatar como JSON
 */
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

/**
 * Determina quais arquivos receberão um log
 * @param level Nível de log
 * @returns Array de nomes de arquivos
 */
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

// ============================================================================
// CLASSE LOGGER
// ============================================================================

/**
 * Logger estruturado com suporte a múltiplos níveis e arquivos
 */
export class Logger {
  /**
   * Registra um log com nível e detalhes
   * @param level Nível do log
   * @param module Módulo que gerou o log
   * @param message Mensagem
   * @param details Detalhes adicionais
   * @returns Entrada de log estruturada
   */
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

    // ✅ Exibir no console
    const formattedConsole = formatConsoleLine(entry);
    console.log(formattedConsole);

    // ✅ Escrever em arquivos
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