"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
var winston = require("winston");
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
var Logger = /** @class */ (function () {
    function Logger() {
    }
    /**
     * Initialize the logger
     */
    Logger.initialize = function () {
        if (!this.logger) {
            this.logger = winston.createLogger({
                level: this.currentLevel,
                format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.printf(function (info) { return "".concat(info.timestamp, " [").concat(info.level, "]: ").concat(info.message); })),
                transports: [
                    new winston.transports.Console(),
                ],
            });
        }
    };
    /**
     * Set the log level
     * @param level The log level to set
     */
    Logger.setLevel = function (level) {
        this.currentLevel = level;
        this.initialize();
        this.logger.level = level;
    };
    /**
     * Log an error message
     * @param message The message to log
     * @param error Optional error object
     */
    Logger.error = function (message, error) {
        this.initialize();
        if (error) {
            this.logger.error("".concat(message), error);
        }
        else {
            this.logger.error(message);
        }
    };
    /**
     * Log a warning message
     * @param message The message to log
     */
    Logger.warn = function (message) {
        this.initialize();
        this.logger.warn(message);
    };
    /**
     * Log an info message
     * @param message The message to log
     */
    Logger.info = function (message) {
        this.initialize();
        this.logger.info(message);
    };
    /**
     * Log a debug message
     * @param message The message to log
     */
    Logger.debug = function (message) {
        this.initialize();
        this.logger.debug(message);
    };
    Logger.currentLevel = LogLevel.INFO;
    return Logger;
}());
exports.Logger = Logger;
