interface FunctionUsage {
  name: string;
  currentLocation: string;
  targetLocation: string;
  status: 'needs-migration' | 'in-progress' | 'completed';
  dependencies: string[];
  usedIn: string[];
}

const migrationPlan: FunctionUsage[] = [
  {
    name: 'handleExtractContent',
    currentLocation: 'src/components/SourceButtons.tsx',
    targetLocation: 'packages/content-extraction/src/index.ts',
    status: 'needs-migration',
    dependencies: ['mammoth', 'supabase'],
    usedIn: [
      'src/pages/source-buttons.tsx',
      'src/components/SourceButtons.tsx'
    ]
  }
];

export function generateMigrationReport(): string {
  return migrationPlan
    .map(func => `
Function: ${func.name}
Current: ${func.currentLocation}
Target: ${func.targetLocation}
Status: ${func.status}
Dependencies: ${func.dependencies.join(', ')}
Used in: 
${func.usedIn.map(location => `- ${location}`).join('\n')}
    `).join('\n---\n');
} 