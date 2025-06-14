#!/usr/bin/env ts-node

/**
 * Automated Service Documentation Generator
 * Generates comprehensive documentation for shared services
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as ts from 'typescript';

interface ServiceMetadata {
  name: string;
  path: string;
  description: string;
  exports: string[];
  methods: MethodInfo[];
  dependencies: string[];
  usageExamples: string[];
}

interface MethodInfo {
  name: string;
  description: string;
  parameters: Array<{ name: string; type: string; optional: boolean }>;
  returnType: string;
  isStatic: boolean;
  isAsync: boolean;
}

class ServiceDocumentationGenerator {
  private supabase = SupabaseClientService.getInstance().getClient();
  
  async generateDocumentation(servicePath: string): Promise<ServiceMetadata> {
    console.log(`Generating documentation for ${servicePath}...`);
    
    const sourceFile = this.parseTypeScriptFile(servicePath);
    const metadata = this.extractMetadata(sourceFile, servicePath);
    
    // Generate markdown documentation
    const markdown = this.generateMarkdown(metadata);
    
    // Save to docs folder
    const serviceName = path.basename(servicePath, '.ts');
    const docsPath = path.join(
      process.cwd(),
      'docs/shared-services',
      `${serviceName}.md`
    );
    
    // Ensure docs directory exists
    const docsDir = path.dirname(docsPath);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    fs.writeFileSync(docsPath, markdown);
    console.log(`✓ Documentation saved to ${docsPath}`);
    
    // Update database
    await this.updateServiceDocumentation(metadata);
    
    return metadata;
  }
  
  private parseTypeScriptFile(filePath: string): ts.SourceFile {
    const content = fs.readFileSync(filePath, 'utf-8');
    return ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
  }
  
  private extractMetadata(sourceFile: ts.SourceFile, filePath: string): ServiceMetadata {
    const metadata: ServiceMetadata = {
      name: path.basename(filePath, '.ts'),
      path: filePath,
      description: this.extractDescription(sourceFile),
      exports: [],
      methods: [],
      dependencies: this.extractDependencies(sourceFile),
      usageExamples: []
    };
    
    // Visit all nodes to extract information
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        metadata.exports.push(node.name.text);
        
        // Extract class methods
        node.members.forEach((member) => {
          if (ts.isMethodDeclaration(member) && member.name) {
            const methodInfo = this.extractMethodInfo(member);
            if (methodInfo) {
              metadata.methods.push(methodInfo);
            }
          }
        });
      }
      
      // Check for exported functions
      if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        metadata.exports.push(node.name.text);
        const methodInfo = this.extractFunctionInfo(node);
        if (methodInfo) {
          metadata.methods.push(methodInfo);
        }
      }
      
      // Check for exported constants
      if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name)) {
            metadata.exports.push(decl.name.text);
          }
        });
      }
    });
    
    // Generate usage examples based on methods
    metadata.usageExamples = this.generateUsageExamples(metadata);
    
    return metadata;
  }
  
  private extractDescription(sourceFile: ts.SourceFile): string {
    // Look for file-level JSDoc comment
    const firstStatement = sourceFile.statements[0];
    if (firstStatement) {
      const leadingComments = ts.getLeadingCommentRanges(
        sourceFile.getFullText(),
        firstStatement.getFullStart()
      );
      
      if (leadingComments && leadingComments.length > 0) {
        const comment = sourceFile.getFullText().substring(
          leadingComments[0].pos,
          leadingComments[0].end
        );
        
        // Extract description from JSDoc
        const descMatch = comment.match(/\*\s*(.+?)(?:\n|\*)/);
        return descMatch ? descMatch[1].trim() : '';
      }
    }
    
    return '';
  }
  
  private extractDependencies(sourceFile: ts.SourceFile): string[] {
    const dependencies: string[] = [];
    
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const dep = moduleSpecifier.text;
          if (!dep.startsWith('.') && !dep.startsWith('@shared')) {
            dependencies.push(dep);
          }
        }
      }
    });
    
    return [...new Set(dependencies)];
  }
  
  private extractMethodInfo(method: ts.MethodDeclaration): MethodInfo | null {
    if (!ts.isIdentifier(method.name)) return null;
    
    const methodName = method.name.text;
    
    // Skip private methods
    if (methodName.startsWith('_') || method.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword)) {
      return null;
    }
    
    return {
      name: methodName,
      description: this.extractJSDocDescription(method),
      parameters: method.parameters.map(param => ({
        name: ts.isIdentifier(param.name) ? param.name.text : 'unknown',
        type: param.type ? param.type.getText() : 'any',
        optional: !!param.questionToken
      })),
      returnType: method.type ? method.type.getText() : 'void',
      isStatic: !!method.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword),
      isAsync: !!method.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)
    };
  }
  
  private extractFunctionInfo(func: ts.FunctionDeclaration): MethodInfo | null {
    if (!func.name) return null;
    
    return {
      name: func.name.text,
      description: this.extractJSDocDescription(func),
      parameters: func.parameters.map(param => ({
        name: ts.isIdentifier(param.name) ? param.name.text : 'unknown',
        type: param.type ? param.type.getText() : 'any',
        optional: !!param.questionToken
      })),
      returnType: func.type ? func.type.getText() : 'void',
      isStatic: false,
      isAsync: !!func.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)
    };
  }
  
  private extractJSDocDescription(node: ts.Node): string {
    const jsDoc = (node as any).jsDoc;
    if (jsDoc && jsDoc.length > 0) {
      const comment = jsDoc[0].comment;
      return comment || '';
    }
    return '';
  }
  
  private generateUsageExamples(metadata: ServiceMetadata): string[] {
    const examples: string[] = [];
    
    // Find getInstance method for singleton
    const getInstance = metadata.methods.find(m => m.name === 'getInstance');
    if (getInstance) {
      examples.push(`const instance = ${metadata.name}.getInstance();`);
    }
    
    // Generate examples for public methods
    metadata.methods.filter(m => !m.name.startsWith('_') && m.name !== 'getInstance').forEach(method => {
      const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
      const call = method.isStatic 
        ? `${metadata.name}.${method.name}(${params})`
        : `instance.${method.name}(${params})`;
      
      if (method.isAsync) {
        examples.push(`await ${call};`);
      } else {
        examples.push(`${call};`);
      }
    });
    
    return examples;
  }
  
  private generateMarkdown(metadata: ServiceMetadata): string {
    const md: string[] = [];
    
    // Header
    md.push(`# ${metadata.name}`);
    md.push('');
    md.push(metadata.description || 'No description available.');
    md.push('');
    
    // Table of contents
    md.push('## Table of Contents');
    md.push('- [Installation](#installation)');
    md.push('- [Usage](#usage)');
    md.push('- [API Reference](#api-reference)');
    md.push('- [Dependencies](#dependencies)');
    md.push('');
    
    // Installation
    md.push('## Installation');
    md.push('');
    md.push('```typescript');
    md.push(`import { ${metadata.exports.join(', ')} } from '@shared/services/${metadata.name}';`);
    md.push('```');
    md.push('');
    
    // Usage
    md.push('## Usage');
    md.push('');
    metadata.usageExamples.forEach(example => {
      md.push('```typescript');
      md.push(example);
      md.push('```');
      md.push('');
    });
    
    // API Reference
    md.push('## API Reference');
    md.push('');
    
    metadata.methods.forEach(method => {
      // Method signature
      const params = method.parameters.map(p => {
        const opt = p.optional ? '?' : '';
        return `${p.name}${opt}: ${p.type}`;
      }).join(', ');
      
      const signature = `${method.name}(${params}): ${method.returnType}`;
      
      md.push(`### ${method.name}`);
      md.push('');
      if (method.description) {
        md.push(method.description);
        md.push('');
      }
      md.push('```typescript');
      md.push(signature);
      md.push('```');
      md.push('');
      
      // Parameters
      if (method.parameters.length > 0) {
        md.push('**Parameters:**');
        method.parameters.forEach(param => {
          const opt = param.optional ? ' (optional)' : '';
          md.push(`- \`${param.name}\`: ${param.type}${opt}`);
        });
        md.push('');
      }
      
      // Return value
      if (method.returnType !== 'void') {
        md.push(`**Returns:** ${method.returnType}`);
        md.push('');
      }
      
      // Modifiers
      const modifiers: string[] = [];
      if (method.isStatic) modifiers.push('static');
      if (method.isAsync) modifiers.push('async');
      if (modifiers.length > 0) {
        md.push(`**Modifiers:** ${modifiers.join(', ')}`);
        md.push('');
      }
    });
    
    // Dependencies
    if (metadata.dependencies.length > 0) {
      md.push('## Dependencies');
      md.push('');
      metadata.dependencies.forEach(dep => {
        md.push(`- ${dep}`);
      });
      md.push('');
    }
    
    // Footer
    md.push('---');
    md.push(`*Generated on ${new Date().toISOString()}*`);
    
    return md.join('\n');
  }
  
  private async updateServiceDocumentation(metadata: ServiceMetadata) {
    const { error } = await this.supabase
      .from('sys_shared_services')
      .update({
        documentation: {
          description: metadata.description,
          exports: metadata.exports,
          methods: metadata.methods.map(m => ({
            name: m.name,
            description: m.description,
            isAsync: m.isAsync,
            isStatic: m.isStatic
          })),
          dependencies: metadata.dependencies,
          examples: metadata.usageExamples,
          generated_at: new Date().toISOString()
        }
      })
      .eq('service_name', metadata.name);
      
    if (error) {
      console.error(`Error updating documentation in database: ${error.message}`);
    } else {
      console.log('✓ Documentation updated in database');
    }
  }
}

// Run if called directly
if (require.main === module) {
  const servicePath = process.argv[2];
  
  if (!servicePath) {
    console.error('Usage: generate-service-docs.ts <service-path>');
    process.exit(1);
  }
  
  const generator = new ServiceDocumentationGenerator();
  generator.generateDocumentation(servicePath)
    .then(() => console.log('Documentation generation complete!'))
    .catch(console.error);
}

export { ServiceDocumentationGenerator };