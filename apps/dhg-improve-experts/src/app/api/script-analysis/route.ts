import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * API route for triggering script analysis
 * 
 * Supports the following actions:
 * - scan: Scan for script files
 * - analyze: Analyze specific script file
 * - batch: Batch analyze script files
 * - status: Get analysis status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, path: scriptPath, options } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required parameter: action' },
        { status: 400 }
      );
    }

    // Root directory
    const rootDir = process.cwd();
    const cliDir = path.join(rootDir, 'scripts', 'cli');
    const scriptScanResults = path.join(rootDir, 'script-scan-results.json');
    const analysisDir = path.join(rootDir, 'script-analysis-results');

    // Make sure output directory exists
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }

    // Handle different actions
    switch (action) {
      case 'scan':
        // Scan for script files
        const scanCmd = `cd ${rootDir} && node ${path.join(
          cliDir,
          'dist/index.js'
        )} scan-scripts --dir ${rootDir} --output ${scriptScanResults}`;
        
        const scanResult = await execAsync(scanCmd);
        
        if (fs.existsSync(scriptScanResults)) {
          const scanData = JSON.parse(fs.readFileSync(scriptScanResults, 'utf-8'));
          return NextResponse.json({
            success: true,
            message: 'Script scan completed successfully',
            data: {
              scriptCount: scanData.length,
              outputPath: scriptScanResults,
            },
            stdout: scanResult.stdout,
          });
        } else {
          return NextResponse.json(
            {
              error: 'Script scan failed - no output file generated',
              stdout: scanResult.stdout,
              stderr: scanResult.stderr,
            },
            { status: 500 }
          );
        }

      case 'analyze':
        // Analyze a specific script file
        if (!scriptPath) {
          return NextResponse.json(
            { error: 'Missing required parameter: path' },
            { status: 400 }
          );
        }

        const outputFile = path.join(
          analysisDir,
          path.basename(scriptPath) + '.analysis.json'
        );
        
        const analyzeCmd = `cd ${rootDir} && node ${path.join(
          cliDir,
          'dist/index.js'
        )} analyze-script --file ${scriptPath} --output ${outputFile}`;
        
        const analyzeResult = await execAsync(analyzeCmd);
        
        if (fs.existsSync(outputFile)) {
          const analysisData = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
          return NextResponse.json({
            success: true,
            message: 'Script analysis completed successfully',
            data: analysisData,
            stdout: analyzeResult.stdout,
          });
        } else {
          return NextResponse.json(
            {
              error: 'Script analysis failed - no output file generated',
              stdout: analyzeResult.stdout,
              stderr: analyzeResult.stderr,
            },
            { status: 500 }
          );
        }

      case 'batch':
        // Batch analyze script files
        if (!fs.existsSync(scriptScanResults)) {
          return NextResponse.json(
            { error: 'Script scan results not found. Run scan action first.' },
            { status: 400 }
          );
        }

        const batchSize = options?.batchSize || 5;
        const concurrency = options?.concurrency || 2;
        
        const batchCmd = `cd ${rootDir} && node ${path.join(
          cliDir,
          'dist/index.js'
        )} batch-analyze-scripts --input ${scriptScanResults} --output-dir ${analysisDir} --batch-size ${batchSize} --concurrency ${concurrency}`;
        
        const batchResult = await execAsync(batchCmd);
        
        // Check if report file was generated
        const reportPath = path.join(analysisDir, 'script-analysis-report.md');
        if (fs.existsSync(reportPath)) {
          return NextResponse.json({
            success: true,
            message: 'Batch script analysis completed successfully',
            data: {
              reportPath,
              categorySummaryPath: path.join(analysisDir, 'category-summary.md'),
            },
            stdout: batchResult.stdout,
          });
        } else {
          return NextResponse.json(
            {
              error: 'Batch script analysis failed - no report file generated',
              stdout: batchResult.stdout,
              stderr: batchResult.stderr,
            },
            { status: 500 }
          );
        }

      case 'status':
        // Get analysis status and summary
        const status = {
          scanCompleted: fs.existsSync(scriptScanResults),
          reportsGenerated: fs.existsSync(path.join(analysisDir, 'script-analysis-report.md')),
          categorySummaryGenerated: fs.existsSync(path.join(analysisDir, 'category-summary.md')),
        };
        
        // Get script counts if scan was completed
        if (status.scanCompleted) {
          const scanData = JSON.parse(fs.readFileSync(scriptScanResults, 'utf-8'));
          status['scriptCount'] = scanData.length;
        }
        
        // Get script type breakdowns if analysis was completed
        if (status.categorySummaryGenerated) {
          const categorySummary = fs.readFileSync(
            path.join(analysisDir, 'category-summary.md'),
            'utf-8'
          );
          
          // Extract category counts using regex
          const categoryMatches = categorySummary.match(/## (.*?)\n\nTotal scripts: (\d+)/g);
          if (categoryMatches) {
            const categoryBreakdown = {};
            categoryMatches.forEach(match => {
              const [, category, count] = match.match(/## (.*?)\n\nTotal scripts: (\d+)/) || [];
              if (category && count) {
                categoryBreakdown[category] = parseInt(count, 10);
              }
            });
            status['categoryBreakdown'] = categoryBreakdown;
          }
        }
        
        return NextResponse.json({
          success: true,
          data: status,
        });

      default:
        return NextResponse.json(
          { error: `Unsupported action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in script-analysis API route:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'An unknown error occurred' },
      { status: 500 }
    );
  }
}

/**
 * API route for getting script analysis results
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const scriptPath = searchParams.get('path');

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required parameter: action' },
        { status: 400 }
      );
    }

    // Root directory
    const rootDir = process.cwd();
    const analysisDir = path.join(rootDir, 'script-analysis-results');

    // Handle different actions
    switch (action) {
      case 'report':
        // Get the script analysis report
        const reportPath = path.join(analysisDir, 'script-analysis-report.md');
        if (fs.existsSync(reportPath)) {
          const report = fs.readFileSync(reportPath, 'utf-8');
          return NextResponse.json({
            success: true,
            data: { report },
          });
        } else {
          return NextResponse.json(
            { error: 'Script analysis report not found' },
            { status: 404 }
          );
        }

      case 'category-summary':
        // Get the category summary
        const categorySummaryPath = path.join(analysisDir, 'category-summary.md');
        if (fs.existsSync(categorySummaryPath)) {
          const summary = fs.readFileSync(categorySummaryPath, 'utf-8');
          return NextResponse.json({
            success: true,
            data: { summary },
          });
        } else {
          return NextResponse.json(
            { error: 'Category summary not found' },
            { status: 404 }
          );
        }

      case 'script-analysis':
        // Get analysis for a specific script
        if (!scriptPath) {
          return NextResponse.json(
            { error: 'Missing required parameter: path' },
            { status: 400 }
          );
        }

        const analysisFile = path.join(
          analysisDir,
          path.basename(scriptPath) + '.analysis.json'
        );
        
        if (fs.existsSync(analysisFile)) {
          const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf-8'));
          return NextResponse.json({
            success: true,
            data: analysis,
          });
        } else {
          return NextResponse.json(
            { error: `Analysis for script ${scriptPath} not found` },
            { status: 404 }
          );
        }

      case 'list-analyses':
        // List all available script analyses
        if (!fs.existsSync(analysisDir)) {
          return NextResponse.json(
            { error: 'Analysis directory not found' },
            { status: 404 }
          );
        }

        const files = fs.readdirSync(analysisDir)
          .filter(file => file.endsWith('.analysis.json'))
          .map(file => {
            // Extract just the original filename without .analysis.json
            const filename = file.replace('.analysis.json', '');
            return {
              filename,
              analysisPath: path.join(analysisDir, file),
            };
          });

        return NextResponse.json({
          success: true,
          data: {
            analysisCount: files.length,
            files,
          },
        });

      default:
        return NextResponse.json(
          { error: `Unsupported action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in script-analysis API route:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'An unknown error occurred' },
      { status: 500 }
    );
  }
}