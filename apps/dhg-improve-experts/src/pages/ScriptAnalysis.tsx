import React from "react";
import { ScriptAnalysisPanel } from "../components/ScriptAnalysisPanel";

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
      
      <div className="grid gap-6">
        <ScriptAnalysisPanel />
      </div>
    </div>
  );
}