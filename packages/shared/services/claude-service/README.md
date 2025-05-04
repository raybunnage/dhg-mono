# Claude Service

This service provides a standardized way to interact with Claude AI models through Anthropic's API.

## Features

- Singleton pattern for consistent access across the codebase
- Retry mechanism for API resilience
- Support for both text and JSON responses
- Detailed error handling and logging
- Text classification helper

## Usage Examples

### Basic Text Generation

```typescript
import { claudeService } from '../../packages/shared/services/claude-service';

// Simple prompt with default parameters
const response = await claudeService.sendPrompt(
  "Explain quantum computing in simple terms."
);
console.log(response);

// Custom parameters
const customResponse = await claudeService.sendPrompt(
  "List 5 ways to improve code quality.",
  {
    model: "claude-3-7-sonnet-20250219",
    temperature: 0.5,
    maxTokens: 2000,
    system: "You are a senior software engineer providing practical advice."
  }
);
console.log(customResponse);
```

### JSON Responses

```typescript
import { claudeService } from '../../packages/shared/services/claude-service';

// Get structured data
interface BookRecommendation {
  title: string;
  author: string;
  year: number;
  genre: string;
  description: string;
}

const recommendations = await claudeService.getJsonResponse<BookRecommendation[]>(
  "Recommend 3 science fiction books from the 1970s."
);

// Books are now strongly typed
recommendations.forEach(book => {
  console.log(`${book.title} (${book.year}) by ${book.author}`);
});
```

### Text Classification

```typescript
import { claudeService } from '../../packages/shared/services/claude-service';

interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  explanation: string;
}

const textToClassify = "I absolutely loved the new product update!";

const result = await claudeService.classifyText<SentimentResult>(
  textToClassify,
  "Analyze the sentiment of the following text. Classify it as positive, negative, or neutral."
);

console.log(`Sentiment: ${result.sentiment}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Explanation: ${result.explanation}`);
```

## Migration Guide

If you're currently using an older version of claude-service.ts, here's how to migrate:

1. Update your imports to use the new service:

```typescript
// Old import
import { ClaudeService } from '../../packages/shared/services/claude-service';

// New import
import { claudeService } from '../../packages/shared/services/claude-service';
```

2. Replace direct instantiation with the singleton instance:

```typescript
// Old code
const claudeService = new ClaudeService();
const response = await claudeService.sendPrompt("Hello");

// New code
import { claudeService } from '../../packages/shared/services/claude-service';
const response = await claudeService.sendPrompt("Hello");
```

3. Use the new helper methods for JSON and classification:

```typescript
// Old code with manual JSON handling
const jsonResponse = await claudeService.sendPrompt("Give me data in JSON format");
const data = JSON.parse(jsonResponse);

// New code
const data = await claudeService.getJsonResponse("Give me data");
```