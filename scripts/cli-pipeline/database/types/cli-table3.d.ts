declare module 'cli-table3' {
  interface TableOptions {
    head?: string[];
    colWidths?: number[];
    colAligns?: string[];
    style?: {
      head?: string[];
      border?: string[];
      compact?: boolean;
      [key: string]: any;
    };
    chars?: {
      top?: string;
      'top-mid'?: string;
      'top-left'?: string;
      'top-right'?: string;
      bottom?: string;
      'bottom-mid'?: string;
      'bottom-left'?: string;
      'bottom-right'?: string;
      left?: string;
      'left-mid'?: string;
      mid?: string;
      'mid-mid'?: string;
      right?: string;
      'right-mid'?: string;
      middle?: string;
      [key: string]: any;
    };
    wordWrap?: boolean;
    truncate?: string;
    colors?: boolean;
    [key: string]: any;
  }

  class Table {
    constructor(options?: TableOptions);
    push(...items: any[][]): void;
    toString(): string;
  }

  export = Table;
}