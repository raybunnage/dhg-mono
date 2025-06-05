import React from "react";
import { ScriptAnalysisPanel } from "../components/ScriptAnalysisPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

/**
 * Script Analysis Page
 * 
 * This page provides a UI for the script analysis pipeline that categorizes
 * script files into document types: AI, Integration, Operations, and Development.
 */
export default function ScriptAnalysis() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Script Analysis Dashboard</h1>
        <p className="text-muted-foreground">
          Analyze and categorize script files into document types such as AI, Integration, Operations, and Development.
        </p>
      </div>
      
      <Tabs defaultValue="dashboard" className="mb-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="setup">Setup Instructions</TabsTrigger>
          <TabsTrigger value="commands">Command Reference</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <div className="grid gap-6">
            <ScriptAnalysisPanel />
          </div>
        </TabsContent>
        
        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
              <CardDescription>Follow these steps to set up the script analysis pipeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">1. Environment Setup</h3>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-sm">
                    {`# Required environment variables
export CLAUDE_API_KEY=your_claude_api_key
export SUPABASE_URL=your_supabase_url
export SUPABASE_KEY=your_supabase_key`}
                  </pre>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">2. Database Migration</h3>
                <p className="text-sm mb-2">Run the database migration script to create tables:</p>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-sm">./apply_script_migrations.sh</pre>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">3. Build CLI Tool</h3>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-sm">
                    {`cd scripts/cli
npm install
npm run build`}
                  </pre>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">4. Run Pipeline</h3>
                <p className="text-sm mb-2">Run the complete pipeline with a single command:</p>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-sm">/Users/raybunnage/Documents/github/dhg-mono/scripts/analyze-scripts.sh</pre>
                </div>
                <p className="text-sm mt-2">Alternatively, use the UI on the Dashboard tab.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="commands">
          <Card>
            <CardHeader>
              <CardTitle>Command Reference</CardTitle>
              <CardDescription>CLI commands for script analysis pipeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Scan Scripts</h3>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-sm">
                    {`node ./scripts/cli/dist/index.js scan-scripts --dir /path/to/repo \\
  --extensions "js,ts,sh,py" \\
  --exclude "node_modules,dist,build,.git" \\
  --output scripts-scan-results.json`}
                  </pre>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Analyze Script</h3>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-sm">
                    {`node ./scripts/cli/dist/index.js analyze-script \\
  --file /path/to/script.js \\
  --output script-analysis.json \\
  --check-references \\
  --update-database`}
                  </pre>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Batch Analyze Scripts</h3>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-sm">
                    {`node ./scripts/cli/dist/index.js batch-analyze-scripts \\
  --input scripts-scan-results.json \\
  --output-dir script-analysis-results \\
  --batch-size 5 \\
  --concurrency 2 \\
  --generate-report`}
                  </pre>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Complete Pipeline</h3>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-sm">/Users/raybunnage/Documents/github/dhg-mono/scripts/analyze-scripts.sh</pre>
                </div>
                <p className="text-sm mt-2">This script will run the entire pipeline: scan, analyze, and generate reports.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}