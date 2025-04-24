"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
const winston = __importStar(require("winston"));
/**
 * Log levels for the application
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Logger class for consistent logging across the application
 */
class Logger {
    /**
     * Initialize the logger
     */
    static initialize() {
        if (!this.logger) {
            this.logger = winston.createLogger({
                level: this.currentLevel,
                format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.printf((info) => `${info.timestamp} [${info.level}]: ${info.message}`)),
                transports: [
                    new winston.transports.Console(),
                ],
            });
        }
    }
    /**
     * Set the log level
     * @param level The log level to set
     */
    static setLevel(level) {
        this.currentLevel = level;
        this.initialize();
        this.logger.level = level;
    }
    /**
     * Log an error message
     * @param message The message to log
     * @param error Optional error object
     */
    static error(message, error) {
        this.initialize();
        if (error) {
            this.logger.error(`${message}`, error);
        }
        else {
            this.logger.error(message);
        }
    }
    /**
     * Log a warning message
     * @param message The message to log
     */
    static warn(message) {
        this.initialize();
        this.logger.warn(message);
    }
    /**
     * Log an info message
     * @param message The message to log
     */
    static info(message) {
        this.initialize();
        this.logger.info(message);
    }
    /**
     * Log a debug message
     * @param message The message to log
     */
    static debug(message) {
        this.initialize();
        this.logger.debug(message);
    }
}
exports.Logger = Logger;
Logger.currentLevel = LogLevel.INFO;
