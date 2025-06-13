/**
 * CLI Service
 * 
 * Provides a consistent command-line interface with command parsing,
 * help text, progress indicators, and formatted output.
 */
import * as readline from 'readline';
import { Command, CommandOption } from '../interfaces/types';
import { nodeLogger as logger } from '@shared/services/logger/logger-node';

/**
 * CLI colors
 */
enum Colors {
  RESET = '\x1b[0m',
  RED = '\x1b[31m',
  GREEN = '\x1b[32m',
  YELLOW = '\x1b[33m',
  BLUE = '\x1b[34m',
  MAGENTA = '\x1b[35m',
  CYAN = '\x1b[36m',
  BOLD = '\x1b[1m'
}

/**
 * CLI Service implementation
 */
export class CLIService {
  private static instance: CLIService;
  private commands: Record<string, Command> = {};
  private programName: string;
  private programDescription: string;
  private spinner: NodeJS.Timeout | null = null;
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerIndex = 0;
  private rl: readline.Interface | null = null;
  
  /**
   * Create CLI service
   * Private constructor to enforce singleton pattern
   */
  private constructor(programName: string, programDescription: string) {
    this.programName = programName;
    this.programDescription = programDescription;
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(programName?: string, programDescription?: string): CLIService {
    if (!CLIService.instance) {
      CLIService.instance = new CLIService(
        programName || 'cli',
        programDescription || 'Command-line interface'
      );
    }
    return CLIService.instance;
  }
  
  /**
   * Register a command
   */
  public registerCommand(command: Command): void {
    this.commands[command.name] = command;
  }
  
  /**
   * Parse command-line arguments and execute command
   */
  public async parseAndExecute(argv: string[] = process.argv): Promise<void> {
    // Remove first two arguments (node and script path)
    const args = argv.slice(2);
    
    // Show help if no arguments
    if (args.length === 0 || args[0] === 'help') {
      this.showHelp();
      return;
    }
    
    const commandName = args[0];
    const command = this.commands[commandName];
    
    // Show command help if requested
    if (args[1] === 'help' || (args.length > 1 && args.includes('--help'))) {
      this.showCommandHelp(commandName);
      return;
    }
    
    // Check if command exists
    if (!command) {
      this.error(`Unknown command: ${commandName}`);
      this.showHelp();
      return;
    }
    
    // Parse command options
    const options = this.parseOptions(args.slice(1), command.options || []);
    
    // Check for required options
    const missingOptions = this.checkRequiredOptions(options, command.options || []);
    if (missingOptions.length > 0) {
      this.error(`Missing required options: ${missingOptions.join(', ')}`);
      this.showCommandHelp(commandName);
      return;
    }
    
    // Execute command
    try {
      await command.action(options);
    } catch (error) {
      this.error(`Error executing command ${commandName}:`);
      console.error(error);
    }
  }
  
  /**
   * Parse command options
   */
  private parseOptions(args: string[], options: CommandOption[]): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Set default values
    for (const option of options) {
      if (option.default !== undefined) {
        result[option.name] = option.default;
      }
    }
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      // Check if argument is an option
      if (arg.startsWith('--')) {
        const optionName = arg.slice(2);
        const option = options.find(opt => opt.name === optionName);
        
        if (!option) {
          this.warn(`Unknown option: ${optionName}`);
          continue;
        }
        
        if (option.type === 'boolean') {
          result[option.name] = true;
        } else {
          // Get option value from next argument
          if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
            const value = args[i + 1];
            result[option.name] = option.type === 'number' ? Number(value) : value;
            i++; // Skip next argument (used as value)
          } else {
            this.error(`Option ${optionName} requires a value`);
          }
        }
      } else if (arg.startsWith('-')) {
        // Short option names
        const shortName = arg.slice(1);
        const option = options.find(opt => opt.shortName === shortName);
        
        if (!option) {
          this.warn(`Unknown option: ${shortName}`);
          continue;
        }
        
        if (option.type === 'boolean') {
          result[option.name] = true;
        } else {
          // Get option value from next argument
          if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            const value = args[i + 1];
            result[option.name] = option.type === 'number' ? Number(value) : value;
            i++; // Skip next argument (used as value)
          } else {
            this.error(`Option ${shortName} requires a value`);
          }
        }
      } else {
        // Positional argument (first one is usually a command and is already handled)
        // Additional positional arguments can be handled here if needed
      }
    }
    
    return result;
  }
  
  /**
   * Check for required options
   */
  private checkRequiredOptions(
    parsedOptions: Record<string, any>,
    optionDefinitions: CommandOption[]
  ): string[] {
    const missingOptions: string[] = [];
    
    for (const option of optionDefinitions) {
      if (option.required && parsedOptions[option.name] === undefined) {
        missingOptions.push(option.name);
      }
    }
    
    return missingOptions;
  }
  
  /**
   * Show help for all commands
   */
  public showHelp(): void {
    console.log(`${Colors.BOLD}${this.programName}${Colors.RESET} - ${this.programDescription}`);
    console.log('');
    console.log(`${Colors.BOLD}Usage:${Colors.RESET} ${this.programName} [command] [options]`);
    console.log('');
    console.log(`${Colors.BOLD}Commands:${Colors.RESET}`);
    
    // Get max command name length for proper alignment
    const maxCommandLength = Math.max(...Object.keys(this.commands).map(cmd => cmd.length));
    
    // Display each command with description
    for (const [name, command] of Object.entries(this.commands)) {
      const paddedName = name.padEnd(maxCommandLength);
      console.log(`  ${Colors.CYAN}${paddedName}${Colors.RESET}  ${command.description}`);
    }
    
    console.log('');
    console.log(`Run '${this.programName} help [command]' for more information on a specific command.`);
  }
  
  /**
   * Show help for a specific command
   */
  public showCommandHelp(commandName: string): void {
    const command = this.commands[commandName];
    
    if (!command) {
      this.error(`Unknown command: ${commandName}`);
      this.showHelp();
      return;
    }
    
    console.log(`${Colors.BOLD}${this.programName} ${commandName}${Colors.RESET} - ${command.description}`);
    console.log('');
    console.log(`${Colors.BOLD}Usage:${Colors.RESET} ${this.programName} ${commandName} [options]`);
    
    if (command.options && command.options.length > 0) {
      console.log('');
      console.log(`${Colors.BOLD}Options:${Colors.RESET}`);
      
      // Get max option name length for proper alignment
      const maxOptionLength = Math.max(
        ...command.options.map(opt => (opt.shortName ? `-${opt.shortName}, ` : '    ').length + `--${opt.name}`.length)
      );
      
      // Display each option with description
      for (const option of command.options) {
        const shortPrefix = option.shortName ? `-${option.shortName}, ` : '    ';
        const optionName = `${shortPrefix}--${option.name}`;
        const paddedName = optionName.padEnd(maxOptionLength + 2);
        const required = option.required ? ` ${Colors.RED}(required)${Colors.RESET}` : '';
        const defaultValue = option.default !== undefined ? ` (default: ${option.default})` : '';
        
        console.log(`  ${Colors.GREEN}${paddedName}${Colors.RESET} ${option.description}${required}${defaultValue}`);
      }
    }
  }
  
  /**
   * Start a spinner with message
   */
  public startSpinner(message: string): void {
    if (this.spinner) {
      this.stopSpinner();
    }
    
    process.stdout.write(`${message} `);
    
    this.spinner = setInterval(() => {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, message.length + 1);
      process.stdout.write(this.spinnerFrames[this.spinnerIndex]);
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
    }, 80);
  }
  
  /**
   * Stop spinner and show final message
   */
  public stopSpinner(finalMessage?: string): void {
    if (this.spinner) {
      clearInterval(this.spinner);
      this.spinner = null;
      
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      
      if (finalMessage) {
        console.log(finalMessage);
      }
    }
  }
  
  /**
   * Show success message
   */
  public success(message: string): void {
    console.log(`${Colors.GREEN}✓ ${message}${Colors.RESET}`);
  }
  
  /**
   * Show error message
   */
  public error(message: string): void {
    console.error(`${Colors.RED}✗ ${message}${Colors.RESET}`);
  }
  
  /**
   * Show warning message
   */
  public warn(message: string): void {
    console.warn(`${Colors.YELLOW}⚠ ${message}${Colors.RESET}`);
  }
  
  /**
   * Show info message
   */
  public info(message: string): void {
    console.info(`${Colors.BLUE}ℹ ${message}${Colors.RESET}`);
  }
  
  /**
   * Create an interactive prompt
   */
  public async prompt(question: string): Promise<string> {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
    }
    
    return new Promise(resolve => {
      this.rl!.question(`${Colors.CYAN}? ${question}${Colors.RESET} `, answer => {
        resolve(answer);
      });
    });
  }
  
  /**
   * Close interactive prompt
   */
  public closePrompt(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
  
  /**
   * Show a progress bar
   */
  public updateProgress(current: number, total: number, message: string = 'Progress'): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((percentage * barLength) / 100);
    const emptyLength = barLength - filledLength;
    
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `${message}: [${filledBar}${emptyBar}] ${percentage}% (${current}/${total})`
    );
    
    if (current === total) {
      process.stdout.write('\n');
    }
  }
}

// Export singleton instance
export const cliService = CLIService.getInstance('document-pipeline', 'Document pipeline management CLI');