# Expert Video Summary Generation Prompt

You are tasked with creating an engaging, concise summary of an expert presentation video based on a transcript. Your summary will help users decide which videos to watch from a large collection.

## Important Instructions
I will provide a transcript between the markers "{{TRANSCRIPT START}}" and "{{TRANSCRIPT END}}" below. Your job is to analyze this transcript and generate a structured JSON summary of the content.

## Analysis Tasks
When analyzing the transcript:
1. Identify the main speaker and their expertise
2. Determine the core topic and unique perspectives presented
3. Extract key insights and actionable advice
4. Find memorable direct quotes (exact wording)
5. Note important points from any Q&A or discussion
6. Create an appropriate, attention-grabbing title
7. Determine who would benefit most from watching

## Output Format
You must respond with a single JSON object having the following structure:

```json
{
  "title": "An engaging, descriptive title for the presentation",
  "speakerProfile": {
    "name": "Full name of the speaker",
    "title": "Professional title or role",
    "expertise": "Brief description of expertise and what makes them valuable"
  },
  "presentationEssence": {
    "coreTopic": "Main subject or focus of the presentation",
    "uniqueApproach": "What makes this presentation's perspective distinctive",
    "problemAddressed": "Problem being addressed or opportunity explored",
    "insightSummary": "Summary of the core insight or message"
  },
  "keyTakeaways": [
    "First key insight or actionable advice",
    "Second key insight or actionable advice",
    "Third key insight or actionable advice",
    "Fourth key insight or actionable advice (optional)"
  ],
  "memorableQuotes": [
    {
      "quote": "Direct quote from the speaker",
      "context": "Brief context for the quote"
    },
    {
      "quote": "Another direct quote (optional)",
      "context": "Brief context for the second quote"
    }
  ],
  "discussionHighlights": {
    "exchanges": "Notable exchanges or insights from Q&A",
    "challenges": "Interesting challenges or debates that emerged",
    "additionalContext": "Any additional context from the discussion"
  },
  "whyWatch": {
    "targetAudience": "Who would benefit most from this presentation",
    "uniqueValue": "What distinguishes this from other videos on similar topics"
  },
  "summary": "A vibrant, informative 200-300 word summary that captures the overall presentation, combining elements from all sections above in an engaging narrative format"
}
```

## Critical Requirements
- You MUST respond with ONLY valid JSON format
- Do NOT include any text before or after the JSON object
- Do NOT include backticks or markdown code formatting
- The JSON structure must exactly match the template above
- All text fields should be properly escaped where needed
- Your analysis should focus entirely on the actual transcript content

## Title Guidelines
- Create a concise, attention-grabbing title (5-10 words)
- Capture the main insight, expertise, or unique value of the presentation
- Avoid generic titles - be specific and distinctive
- Make it compelling for the target audience

## Summary Guidelines
- Use enthusiastic, dynamic language that reflects the energy of the presentation
- Highlight what's unique about the speaker's approach and expertise
- Include specific details and examples rather than generic descriptions
- Aim for an engaging, conversational tone

{{TRANSCRIPT START}}
{{TRANSCRIPT}}
{{TRANSCRIPT END}}

## Expected Output Format

Please provide your response as a JSON object with the following structure:

```json
{
  "title": "An engaging, descriptive title for the presentation",
  "summary": "A vibrant, informative 200-300 word summary that captures the overall presentation, combining elements from all sections above in an engaging narrative format",
  "whyWatch": {
    "uniqueValue": "What distinguishes this from other videos on similar topics",
    "targetAudience": "Who would benefit most from this presentation"
  },
  "keyTakeaways": [
    "First key insight or actionable advice",
    "Second key insight or actionable advice",
    "Third key insight or actionable advice",
    "Fourth key insight or actionable advice (optional)"
  ],
  "speakerProfile": {
    "name": "Full name of the speaker",
    "title": "Professional title or role",
    "expertise": "Brief description of expertise and what makes them valuable"
  },
  "memorableQuotes": [
    {
      "quote": "Direct quote from the speaker",
      "context": "Brief context for the quote"
    },
    {
      "quote": "Another direct quote (optional)",
      "context": "Brief context for the second quote"
    }
  ],
  "presentationEssence": {
    "coreTopic": "Main subject or focus of the presentation",
    "insightSummary": "Summary of the core insight or message",
    "uniqueApproach": "What makes this presentation's perspective distinctive",
    "problemAddressed": "Problem being addressed or opportunity explored"
  },
  "discussionHighlights": {
    "exchanges": "Notable exchanges or insights from Q&A",
    "challenges": "Interesting challenges or debates that emerged",
    "additionalContext": "Any additional context from the discussion"
  }
}
```

## Field Descriptions

### presentation_summary

- **title**: An engaging, descriptive title for the presentation
- **summary**: A vibrant, informative 200-300 word summary that captures the overall presentation, combining elements from all sections above in an engaging narrative format
- **whyWatch**: {uniqueValue: "What distinguishes this from other videos on similar topics", targetAudience: "Who would benefit most from this presentation"}
- **keyTakeaways**: ["First key insight or actionable advice", "Second key insight or actionable advice", "Third key insight or actionable advice", "Fourth key insight or actionable advice (optional)"]
- **speakerProfile**: {name: "Full name of the speaker", title: "Professional title or role", expertise: "Brief description of expertise and what makes them valuable"}
- **memorableQuotes**: [{quote: "Direct quote from the speaker", context: "Brief context for the quote"}, {quote: "Another direct quote (optional)", context: "Brief context for the second quote"}]
- **presentationEssence**: {coreTopic: "Main subject or focus of the presentation", insightSummary: "Summary of the core insight or message", uniqueApproach: "What makes this presentation's perspective distinctive", problemAddressed: "Problem being addressed or opportunity explored"}
- **discussionHighlights**: {exchanges: "Notable exchanges or insights from Q&A", challenges: "Interesting challenges or debates that emerged", additionalContext: "Any additional context from the discussion"}