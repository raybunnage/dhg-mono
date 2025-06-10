/**
 * Utility to extract phase information from continuously updated markdown documents
 */

export interface PhaseInfo {
  phaseName: string;
  targetDate?: string;
  status?: string;
  tasks: string[];
  rawContent: string;
}

export interface UpcomingPhase {
  phaseName: string;
  description: string;
  items: string[];
}

/**
 * Extracts the "Next Phase" section from markdown content
 */
export function extractNextPhase(markdownContent: string): PhaseInfo | null {
  try {
    // Look for the Next Phase section
    const nextPhaseRegex = /## Next Phase\s*\n([\s\S]*?)(?=\n##|$)/i;
    const match = markdownContent.match(nextPhaseRegex);
    
    if (!match) return null;
    
    const phaseContent = match[1];
    
    // Extract phase name
    const phaseNameMatch = phaseContent.match(/###?\s*(?:🚀\s*)?Phase:\s*(.+)/i);
    const phaseName = phaseNameMatch ? phaseNameMatch[1].trim() : 'Unnamed Phase';
    
    // Extract target date
    const targetDateMatch = phaseContent.match(/\*\*Target Date\*\*:\s*(.+)/i);
    const targetDate = targetDateMatch ? targetDateMatch[1].trim() : undefined;
    
    // Extract status
    const statusMatch = phaseContent.match(/\*\*Status\*\*:\s*(.+)/i);
    const status = statusMatch ? statusMatch[1].trim() : undefined;
    
    // Extract tasks (checkboxes)
    const taskRegex = /- \[[x\s]\]\s*(.+)/gi;
    const tasks: string[] = [];
    let taskMatch;
    
    while ((taskMatch = taskRegex.exec(phaseContent)) !== null) {
      tasks.push(taskMatch[1].trim());
    }
    
    return {
      phaseName,
      targetDate,
      status,
      tasks,
      rawContent: phaseContent
    };
  } catch (error) {
    console.error('Error extracting next phase:', error);
    return null;
  }
}

/**
 * Extracts upcoming phases from the "Upcoming Phases" section
 */
export function extractUpcomingPhases(markdownContent: string): UpcomingPhase[] {
  try {
    const upcomingPhasesRegex = /## Upcoming Phases\s*\n([\s\S]*?)(?=\n##|$)/i;
    const match = markdownContent.match(upcomingPhasesRegex);
    
    if (!match) return [];
    
    const upcomingContent = match[1];
    const phases: UpcomingPhase[] = [];
    
    // Split by phase headers (### Phase N: Title)
    const phaseBlocks = upcomingContent.split(/###\s*Phase\s*\d+:\s*/i).filter(Boolean);
    
    for (const block of phaseBlocks) {
      const lines = block.trim().split('\n');
      const phaseName = lines[0]?.replace(/\(.*?\)/, '').trim() || 'Unnamed Phase';
      
      const items: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('-')) {
          items.push(line.substring(1).trim());
        }
      }
      
      if (phaseName) {
        phases.push({
          phaseName,
          description: items.join('; '),
          items
        });
      }
    }
    
    return phases;
  } catch (error) {
    console.error('Error extracting upcoming phases:', error);
    return [];
  }
}

/**
 * Creates a formatted summary of the next phase suitable for display
 */
export function formatNextPhaseSummary(phaseInfo: PhaseInfo): string {
  const parts: string[] = [];
  
  if (phaseInfo.targetDate) {
    parts.push(`Target: ${phaseInfo.targetDate}`);
  }
  
  if (phaseInfo.status) {
    parts.push(`Status: ${phaseInfo.status}`);
  }
  
  if (phaseInfo.tasks.length > 0) {
    parts.push(`${phaseInfo.tasks.length} tasks`);
  }
  
  return parts.join(' • ');
}

/**
 * Generates a dev task description from phase information
 */
export function generateDevTaskFromPhase(
  phaseInfo: PhaseInfo,
  docTitle: string,
  docPath: string
): string {
  let description = `## Implementation Plan for: ${phaseInfo.phaseName}\n\n`;
  description += `**Source Document**: ${docTitle}\n`;
  description += `**Document Path**: ${docPath}\n\n`;
  
  if (phaseInfo.targetDate) {
    description += `**Target Date**: ${phaseInfo.targetDate}\n`;
  }
  
  if (phaseInfo.status) {
    description += `**Current Status**: ${phaseInfo.status}\n`;
  }
  
  description += `\n### Tasks to Complete\n\n`;
  
  if (phaseInfo.tasks.length > 0) {
    phaseInfo.tasks.forEach((task, index) => {
      description += `${index + 1}. ${task}\n`;
    });
  } else {
    description += `No specific tasks defined. Please review the phase requirements and define implementation steps.\n`;
  }
  
  description += `\n### Implementation Steps\n\n`;
  description += `1. Review the full documentation in the source document\n`;
  description += `2. Break down each task into specific technical requirements\n`;
  description += `3. Identify dependencies and prerequisites\n`;
  description += `4. Create test cases for each feature\n`;
  description += `5. Implement features incrementally\n`;
  description += `6. Update documentation as features are completed\n`;
  description += `7. Mark tasks complete in the source document\n`;
  
  description += `\n### Success Criteria\n\n`;
  description += `- All listed tasks are completed and tested\n`;
  description += `- Source document is updated to reflect completion\n`;
  description += `- No regressions in existing functionality\n`;
  description += `- Code follows project standards and patterns\n`;
  
  return description;
}