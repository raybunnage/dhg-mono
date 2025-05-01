# Expert Video Summary Generation Prompt

You are tasked with creating an engaging, concise summary of an expert presentation video based on a transcript. Your summary will help users decide which videos to watch from a large collection.

## Input Context
I'll provide you with a transcript summary from Whisper of a video presentation featuring an expert speaker, often with a host and a follow-up discussion.

## Output Format
After reviewing the transcript, create an appropriate title that captures the essence of the presentation, and generate a JSON object with the following structure:

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

## Title Guidelines
- Create a concise, attention-grabbing title (5-10 words)
- Capture the main insight, expertise, or unique value of the presentation
- Avoid generic titles - be specific and distinctive
- Consider including the speaker's unique approach or methodology
- Make it compelling for the target audience

## Style Guidelines for the Summary Field
- Use enthusiastic, dynamic language that reflects the energy of the presentation
- Highlight what's unique about the speaker's approach, perspective, or expertise
- Convey the speaker's personality and presentation style
- Include specific details and examples rather than generic descriptions
- Make the reader feel the excitement and value of the presentation
- Avoid unnecessary jargon while preserving essential technical terminology
- Aim for an engaging, conversational tone rather than a formal academic summary

Remember, your JSON response should make the presentation feel accessible and valuable while accurately representing its content and speaker's expertise. Ensure valid JSON formatting with proper quoting and escaping of special characters.
