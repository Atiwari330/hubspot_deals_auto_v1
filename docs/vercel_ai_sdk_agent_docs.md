# Vercel AI SDK: Comprehensive Agent Building Guide
**Version: AI SDK 5 (October 2025)**

## Table of Contents
1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Installation & Setup](#installation--setup)
4. [Building Agents with the Agent Class](#building-agents-with-the-agent-class)
5. [Tool Definition & Usage](#tool-definition--usage)
6. [Loop Control & Multi-Step Execution](#loop-control--multi-step-execution)
7. [Advanced Patterns](#advanced-patterns)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Code Examples](#code-examples)
11. [Integration with External APIs](#integration-with-external-apis)

---

## Introduction

The Vercel AI SDK is the leading TypeScript toolkit for building AI-powered applications and agents. With over 2 million weekly downloads, it provides a unified interface for working with multiple AI providers (OpenAI, Anthropic, Google, etc.) through a single, type-safe API.

### Key Features (AI SDK 5)
- **Agent Class**: Object-oriented approach to building agents with built-in loop management
- **Type-Safe Chat**: Full TypeScript support for custom message types and tool invocations
- **Agentic Loop Control**: Fine-grained control with `stopWhen` and `prepareStep`
- **SSE-Based Streaming**: Server-Sent Events for stable real-time responses
- **Dynamic Tools**: Runtime-defined tools with input and output validation
- **Multi-Provider Support**: Switch between providers with a single line change

### What is an Agent?
Agents are large language models (LLMs) that use tools in a loop to accomplish tasks. An agent consists of three core components:

1. **LLMs**: Process input and decide what action to take next
2. **Tools**: Extend capabilities beyond text generation (reading files, calling APIs, writing to databases)
3. **Loop**: Orchestrates execution through context management and stopping conditions

---

## Core Concepts

### Building Blocks

#### Single-Step Generation
One call to an LLM to get a response. Use for straightforward tasks like classification or text generation.

```typescript
import { generateText } from 'ai';

const result = await generateText({
  model: 'openai/gpt-4o',
  prompt: 'Classify this sentiment: "I love this product!"',
});
```

#### Tool Usage
Enhance LLM capabilities through tools that provide access to external systems.

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: 'openai/gpt-4o',
  prompt: 'What is the weather in San Francisco?',
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
  },
});
```

#### Multi-Step Tool Usage (Agents)
For complex problems, an LLM can make multiple tool calls across multiple steps.

```typescript
import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: 'openai/gpt-4o',
  prompt: 'What is the weather in San Francisco in celsius?',
  tools: {
    weather: tool({
      description: 'Get the weather in a location (in Fahrenheit)',
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
    convertFahrenheitToCelsius: tool({
      description: 'Convert temperature from Fahrenheit to Celsius',
      inputSchema: z.object({
        temperature: z.number(),
      }),
      execute: async ({ temperature }) => {
        const celsius = Math.round((temperature - 32) * (5 / 9));
        return { celsius };
      },
    }),
  },
  stopWhen: stepCountIs(10), // Stop after maximum 10 steps
});
```

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- TypeScript recommended
- Basic knowledge of async/await

### Installation

```bash
npm install ai zod
```

### Provider Installation (Optional)
Install specific provider packages if not using AI Gateway:

```bash
npm install @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

### Configuration

Using AI Gateway (recommended):
```typescript
import { generateText } from 'ai';

const result = await generateText({
  model: 'openai/gpt-4o', // Simple string identifier
  prompt: 'Hello!',
});
```

Using Direct Provider:
```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello!',
});
```

---

## Building Agents with the Agent Class

The Agent class provides a structured way to encapsulate LLM configuration, tools, and behavior into reusable components. It handles the agent loop for you, allowing the LLM to call tools multiple times in sequence to accomplish complex tasks.

### Why Use the Agent Class?

- **Reduces boilerplate**: Manages loops and message arrays automatically
- **Improves reusability**: Define once, use throughout your application
- **Simplifies maintenance**: Single place to update agent configuration
- **Type safety**: Full TypeScript support for tools and outputs

### Creating an Agent

```typescript
import { Experimental_Agent as Agent } from 'ai';

const myAgent = new Agent({
  model: 'openai/gpt-4o',
  system: 'You are a helpful assistant.',
  tools: {
    // Your tools here
  },
});
```

### Complete Agent Example

```typescript
import { Experimental_Agent as Agent, tool, stepCountIs } from 'ai';
import { z } from 'zod';

const codeAgent = new Agent({
  model: 'openai/gpt-4o',
  system: `You are an expert software engineer.
  
Your approach:
- Focus on security vulnerabilities first
- Identify performance bottlenecks
- Suggest improvements for readability and maintainability
- Be constructive and educational in your feedback`,
  
  tools: {
    runCode: tool({
      description: 'Execute Python code',
      inputSchema: z.object({
        code: z.string(),
      }),
      execute: async ({ code }) => {
        // Execute code and return result
        return { output: 'Code executed successfully' };
      },
    }),
    
    analyzeCode: tool({
      description: 'Analyze code for security and performance issues',
      inputSchema: z.object({
        code: z.string(),
      }),
      execute: async ({ code }) => {
        // Analyze code
        return { issues: [], suggestions: [] };
      },
    }),
  },
  
  stopWhen: stepCountIs(20), // Allow up to 20 steps
});
```

### Using an Agent

#### Generate Text
```typescript
const result = await myAgent.generate({
  prompt: 'What is the weather like?',
});

console.log(result.text);
```

#### Stream Text
```typescript
const stream = myAgent.stream({
  prompt: 'Tell me a story',
});

for await (const chunk of stream.textStream) {
  console.log(chunk);
}
```

#### Respond to UI Messages (API Route)
```typescript
// In your API route (e.g., app/api/chat/route.ts)
import { validateUIMessages } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  return myAgent.respond({
    messages: await validateUIMessages({ messages }),
  });
}
```

### End-to-End Type Safety

```typescript
import { 
  Experimental_Agent as Agent, 
  Experimental_InferAgentUIMessage as InferAgentUIMessage 
} from 'ai';

const myAgent = new Agent({
  // ... configuration
});

// Infer the UIMessage type for UI components
export type MyAgentUIMessage = InferAgentUIMessage<typeof myAgent>;
```

Use in client components:
```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import type { MyAgentUIMessage } from '@/agent/my-agent';

export function Chat() {
  const { messages } = useChat<MyAgentUIMessage>();
  // Full type safety for messages and tools
}
```

---

## Tool Definition & Usage

Tools are the bridge between the LLM and the real world, enabling agents to perform actions and retrieve information.

### Tool Structure

A tool consists of three key properties:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  // 1. Description: Tells the model when and how to use the tool
  description: 'Get current weather for a location',
  
  // 2. Input Schema: Defines and validates tool inputs
  inputSchema: z.object({
    location: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  
  // 3. Execute: Function that performs the action
  execute: async ({ location, unit = 'celsius' }) => {
    // Call weather API
    return {
      temperature: 22,
      conditions: 'Sunny',
      unit,
    };
  },
});
```

### Writing Effective Tool Descriptions

The description field is crucial for model decision-making. Include:
- **What the tool does**
- **When it should be used**
- **What kind of results it returns**

Example:
```typescript
const searchTool = tool({
  description: `Search the web for current information. Use this when:
  - The user asks about recent events, news, or current data
  - You need to verify facts or get updated information
  - The query requires real-time data (stock prices, weather, etc.)
  
  Returns: Array of search results with title, snippet, and URL`,
  
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  
  execute: async ({ query }) => {
    // Implement search logic (e.g., using Exa API)
    return { results: [] };
  },
});
```

### Tool Execution Options

Tools have access to execution context:

```typescript
const contextTool = tool({
  description: 'Sample tool with context',
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async (args, context) => {
    // Access tool call ID
    const id = context.toolCallId;
    
    // Access conversation history
    const history = context.messages;
    
    // Handle cancellation
    context.abortSignal.addEventListener('abort', () => {
      // Clean up resources
    });
    
    return { result: 'Done' };
  },
});
```

### Output Schema (AI SDK 5)

Define expected output types for type safety:

```typescript
const typedTool = tool({
  description: 'Get user information',
  inputSchema: z.object({
    userId: z.string(),
  }),
  outputSchema: z.object({
    name: z.string(),
    email: z.string(),
    age: z.number(),
  }),
  execute: async ({ userId }) => {
    // Return type is validated against outputSchema
    return {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    };
  },
});
```

### Tool Choice Control

Control how the agent uses tools:

```typescript
const agent = new Agent({
  model: 'openai/gpt-4o',
  tools: { weather: weatherTool },
  
  // Default - model decides
  toolChoice: 'auto',
  
  // Force tool use
  // toolChoice: 'required',
  
  // Disable tools
  // toolChoice: 'none',
  
  // Force specific tool
  // toolChoice: { type: 'tool', toolName: 'weather' },
});
```

### Dynamic Tools

Create tools where types are determined at runtime:

```typescript
import { dynamicTool } from 'ai';

const dynamicSearchTool = dynamicTool({
  description: 'Search with dynamic parameters',
  execute: async ({ parameters }) => {
    // Handle dynamic inputs
    return { results: [] };
  },
});
```

### Preliminary Tool Results

For long-running operations, stream intermediate results:

```typescript
const longRunningTool = tool({
  description: 'Process large dataset',
  inputSchema: z.object({
    datasetId: z.string(),
  }),
  execute: async function* ({ datasetId }) {
    // Yield preliminary results
    yield { progress: 25, status: 'Processing...' };
    yield { progress: 50, status: 'Halfway there...' };
    yield { progress: 75, status: 'Almost done...' };
    
    // Return final result
    return { progress: 100, status: 'Complete', data: [] };
  },
});
```

### Tool Lifecycle Hooks

AI SDK 5 introduces lifecycle hooks:

```typescript
const trackedTool = tool({
  description: 'Tool with lifecycle tracking',
  inputSchema: z.object({ query: z.string() }),
  
  onStart: async (context) => {
    console.log('Tool execution started:', context.toolCallId);
  },
  
  onInputDelta: async ({ inputTextDelta, ...context }) => {
    console.log('Streaming input:', inputTextDelta);
  },
  
  execute: async ({ query }) => {
    return { result: 'Done' };
  },
});
```

---

## Loop Control & Multi-Step Execution

Loop control is the heart of agent behavior, determining when agents continue executing and what settings they use at each step.

### stopWhen: Defining Stop Conditions

The `stopWhen` parameter controls when to stop execution when there are tool results in the last step.

#### Built-in Conditions

```typescript
import { generateText, stepCountIs, hasToolCall } from 'ai';

const result = await generateText({
  model: 'openai/gpt-4o',
  tools: { /* your tools */ },
  
  // Stop after maximum 10 steps
  stopWhen: stepCountIs(10),
  
  prompt: 'Analyze this dataset and create a summary report',
});
```

#### Combining Multiple Conditions

```typescript
const result = await generateText({
  model: 'openai/gpt-4o',
  tools: { /* your tools */ },
  
  stopWhen: [
    stepCountIs(10),           // Maximum 10 steps
    hasToolCall('finalReport'), // Stop after calling specific tool
  ],
  
  prompt: 'Research and analyze the topic',
});
```

#### Custom Stop Conditions

```typescript
import { StopCondition, ToolSet } from 'ai';

const tools = {
  // your tools
} satisfies ToolSet;

// Stop when model generates specific text
const hasAnswer: StopCondition<typeof tools> = ({ steps }) => {
  return steps.some(step => step.text?.includes('ANSWER:')) ?? false;
};

// Stop when budget is exceeded
const budgetExceeded: StopCondition<typeof tools> = ({ steps }) => {
  const totalUsage = steps.reduce(
    (acc, step) => ({
      inputTokens: acc.inputTokens + (step.usage?.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (step.usage?.outputTokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0 }
  );

  const costEstimate = 
    (totalUsage.inputTokens * 0.01 + totalUsage.outputTokens * 0.03) / 1000;
  
  return costEstimate > 0.5; // Stop if cost exceeds $0.50
};

const result = await generateText({
  model: 'openai/gpt-4o',
  tools,
  stopWhen: [hasAnswer, budgetExceeded],
  prompt: 'Find the answer and respond with "ANSWER: [your answer]"',
});
```

### prepareStep: Dynamic Step Configuration

The `prepareStep` callback runs before each step, allowing you to modify settings dynamically.

#### Dynamic Model Selection

```typescript
const result = await generateText({
  model: 'openai/gpt-4o-mini', // Default model
  tools: { /* your tools */ },
  
  prepareStep: async ({ stepNumber, messages }) => {
    // Use a stronger model for complex reasoning after initial steps
    if (stepNumber > 2 && messages.length > 10) {
      return {
        model: 'openai/gpt-4o',
      };
    }
    
    // Continue with default settings
    return {};
  },
});
```

#### Context Management

```typescript
const result = await generateText({
  model: 'openai/gpt-4o',
  tools: { /* your tools */ },
  
  prepareStep: async ({ messages }) => {
    // Keep only recent messages to stay within context limits
    if (messages.length > 20) {
      return {
        messages: [
          messages[0],           // Keep system message
          ...messages.slice(-10), // Keep last 10 messages
        ],
      };
    }
    
    return {};
  },
});
```

#### Tool Selection by Phase

```typescript
const result = await generateText({
  model: 'openai/gpt-4o',
  tools: {
    search: searchTool,
    analyze: analyzeTool,
    summarize: summarizeTool,
  },
  
  prepareStep: async ({ stepNumber, steps }) => {
    // Search phase (steps 0-2)
    if (stepNumber <= 2) {
      return {
        activeTools: ['search'],
        toolChoice: 'required',
      };
    }

    // Analysis phase (steps 3-5)
    if (stepNumber <= 5) {
      return {
        activeTools: ['analyze'],
      };
    }

    // Summary phase (step 6+)
    return {
      activeTools: ['summarize'],
      toolChoice: 'required',
    };
  },
});
```

#### Message Modification

```typescript
const result = await generateText({
  model: 'openai/gpt-4o',
  messages,
  tools: { /* your tools */ },
  
  prepareStep: async ({ messages, stepNumber }) => {
    // Summarize tool results to reduce token usage
    const processedMessages = messages.map(msg => {
      if (msg.role === 'tool' && msg.content.length > 1000) {
        return {
          ...msg,
          content: summarizeToolResult(msg.content),
        };
      }
      return msg;
    });

    return { messages: processedMessages };
  },
});
```

### Accessing Step Information

Both `stopWhen` and `prepareStep` receive detailed execution context:

```typescript
prepareStep: async ({
  model,      // Current model configuration
  stepNumber, // Current step number (0-indexed)
  steps,      // All previous steps with their results
  messages,   // Messages to be sent to the model
}) => {
  // Access previous tool calls and results
  const previousToolCalls = steps.flatMap(step => step.toolCalls);
  const previousResults = steps.flatMap(step => step.toolResults);

  // Make decisions based on execution history
  if (previousToolCalls.some(call => call.toolName === 'dataAnalysis')) {
    return {
      toolChoice: {
        type: 'tool',
        toolName: 'reportGenerator',
      },
    };
  }

  return {};
},
```

### Agent Class with Loop Control

```typescript
import { Experimental_Agent as Agent, stepCountIs } from 'ai';

const researchAgent = new Agent({
  model: 'openai/gpt-4o',
  system: 'You are a research assistant.',
  
  tools: {
    search: searchTool,
    analyze: analyzeTool,
  },
  
  stopWhen: [
    stepCountIs(20),
    hasToolCall('finalReport'),
  ],
  
  prepareStep: async ({ stepNumber, steps }) => {
    // Custom logic per step
    if (stepNumber > 10) {
      return { model: 'openai/gpt-4o-mini' }; // Use cheaper model
    }
    return {};
  },
});
```

---

## Advanced Patterns

### Structured Output with Agents

```typescript
import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai';
import { z } from 'zod';

const analysisAgent = new Agent({
  model: 'openai/gpt-4o',
  
  experimental_output: Output.object({
    schema: z.object({
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      summary: z.string(),
      keyPoints: z.array(z.string()),
    }),
  }),
  
  stopWhen: stepCountIs(10),
});

const { experimental_output: output } = await analysisAgent.generate({
  prompt: 'Analyze customer feedback from the last quarter',
});

console.log(output.sentiment); // Type-safe access
```

### Multi-Agent Workflows

```typescript
// Define specialized agents
const researchAgent = new Agent({
  model: 'openai/gpt-4o',
  system: 'You are a research specialist. Gather information thoroughly.',
  tools: { search: searchTool },
  stopWhen: stepCountIs(5),
});

const analysisAgent = new Agent({
  model: 'openai/gpt-4o',
  system: 'You are an analyst. Analyze data deeply.',
  tools: { analyze: analyzeTool },
  stopWhen: stepCountIs(5),
});

const summaryAgent = new Agent({
  model: 'openai/gpt-4o',
  system: 'You are a writer. Create concise summaries.',
  tools: { format: formatTool },
  stopWhen: stepCountIs(3),
});

// Orchestrate workflow
async function multiAgentWorkflow(query: string) {
  // Step 1: Research
  const researchResult = await researchAgent.generate({
    prompt: query,
  });

  // Step 2: Analysis
  const analysisResult = await analysisAgent.generate({
    prompt: `Analyze this research: ${researchResult.text}`,
  });

  // Step 3: Summary
  const summaryResult = await summaryAgent.generate({
    prompt: `Summarize this analysis: ${analysisResult.text}`,
  });

  return summaryResult.text;
}
```

### Manual Loop Control

For maximum control, implement your own loop:

```typescript
import { generateText, ModelMessage } from 'ai';

const messages: ModelMessage[] = [
  { role: 'user', content: 'Complex multi-step task' }
];

let step = 0;
const maxSteps = 10;

while (step < maxSteps) {
  const result = await generateText({
    model: 'openai/gpt-4o',
    messages,
    tools: { /* your tools */ },
  });

  // Add response to conversation
  messages.push(...result.response.messages);

  // Custom stop logic
  if (result.text) {
    break; // Stop when model generates text
  }
  
  // Additional custom logic
  if (someCustomCondition(result)) {
    break;
  }

  step++;
}
```

### Streaming with Tool Calls

```typescript
import { streamText, tool } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: 'openai/gpt-4o',
  tools: {
    getWeather: tool({
      description: 'Get weather information',
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => {
        return { temperature: 72, conditions: 'Sunny' };
      },
    }),
  },
  stopWhen: stepCountIs(5),
  prompt: 'What is the weather in SF?',
  
  onStepFinish: async (step) => {
    console.log('Step finished:', step.stepNumber);
    console.log('Tool calls:', step.toolCalls);
    console.log('Text:', step.text);
  },
});

// Stream the response
for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

---

## Error Handling

### Tool Execution Errors

Tool execution errors appear as `tool-error` content parts:

```typescript
try {
  const result = await generateText({
    model: 'openai/gpt-4o',
    tools: { myTool: riskyTool },
    prompt: 'Use the tool',
  });
  
  // Check for tool errors in steps
  result.steps.forEach(step => {
    step.response.messages.forEach(message => {
      if (message.role === 'tool' && message.content) {
        message.content.forEach(part => {
          if (part.type === 'tool-error') {
            console.error('Tool error:', part.error);
          }
        });
      }
    });
  });
} catch (error) {
  console.error('Fatal error:', error);
}
```

### Stream Error Handling

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: 'openai/gpt-4o',
  tools: { myTool },
  prompt: 'Execute task',
});

// Handle errors in stream
try {
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
} catch (error) {
  console.error('Stream error:', error);
}

// Or use data stream with error handling
return result.toDataStreamResponse({
  getErrorMessage: (error) => {
    if (error instanceof NoSuchToolError) {
      return 'Unknown tool requested';
    }
    if (error instanceof InvalidToolArgumentsError) {
      return 'Invalid tool arguments';
    }
    if (error instanceof ToolExecutionError) {
      return 'Tool execution failed';
    }
    return 'An error occurred';
  },
});
```

### Tool Call Repair

Automatically repair invalid tool calls:

```typescript
const result = await generateText({
  model: 'openai/gpt-4o',
  tools: { calculator: calculatorTool },
  prompt: 'Calculate 5+7',
  
  experimental_repairToolCall: async ({ toolCall, tools, error }) => {
    if (error.name === 'InvalidToolArgumentsError') {
      // Attempt to fix invalid arguments
      return {
        ...toolCall,
        args: JSON.stringify({ a: 5, b: 7 }),
      };
    }
    
    return null; // Can't repair
  },
});
```

### Robust Tool Implementation

```typescript
const robustTool = tool({
  description: 'Search with error handling',
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    try {
      const results = await searchAPI(query);
      return { success: true, results };
    } catch (error) {
      // Log error but return graceful response
      console.error('Search failed:', error);
      return {
        success: false,
        error: 'Search service temporarily unavailable',
        fallbackSuggestions: ['Try again later', 'Refine your query'],
      };
    }
  },
});
```

---

## Best Practices

### 1. Design Philosophy

**Keep Agents Narrow and Specific**
```typescript
// ✅ Good: Specific, well-defined purpose
const invoiceAgent = new Agent({
  model: 'openai/gpt-4o',
  system: 'You extract invoice data and validate amounts.',
  tools: { extractInvoice, validateAmount },
});

// ❌ Bad: Too broad, hard to maintain
const generalAgent = new Agent({
  model: 'openai/gpt-4o',
  system: 'You do everything: invoices, customer support, data analysis...',
  tools: { /* dozens of tools */ },
});
```

### 2. Tool Description Best Practices

```typescript
// ✅ Good: Clear, specific, actionable
const goodTool = tool({
  description: `Search the web for recent information.

Use when:
- User asks about current events or recent news
- Query requires real-time data (stock prices, weather, sports scores)
- Need to verify facts or get updated information

Returns: Array of search results with title, snippet, and URL`,
  
  inputSchema: z.object({
    query: z.string().describe('Search query (2-100 words)'),
    limit: z.number().optional().describe('Max results (default: 5)'),
  }),
  
  execute: async ({ query, limit = 5 }) => {
    // Implementation
  },
});

// ❌ Bad: Vague, unhelpful
const badTool = tool({
  description: 'Searches things',
  inputSchema: z.object({ q: z.string() }),
  execute: async ({ q }) => { /* ... */ },
});
```

### 3. Context Management

```typescript
// ✅ Good: Manage context window proactively
const agent = new Agent({
  model: 'openai/gpt-4o',
  
  prepareStep: async ({ messages, stepNumber }) => {
    // Summarize old messages to save tokens
    if (messages.length > 20) {
      const systemMsg = messages[0];
      const recentMsgs = messages.slice(-10);
      const oldMsgs = messages.slice(1, -10);
      
      const summary = await summarizeMessages(oldMsgs);
      
      return {
        messages: [
          systemMsg,
          { role: 'system', content: `Previous conversation summary: ${summary}` },
          ...recentMsgs,
        ],
      };
    }
    
    return {};
  },
});
```

### 4. Deterministic Logic When Possible

```typescript
// ✅ Good: Use code for deterministic operations
const processData = (data: any[]) => {
  // Use regular code for calculations, sorting, filtering
  return data
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
};

// Only use LLM for what requires reasoning
const agent = new Agent({
  model: 'openai/gpt-4o',
  system: 'Analyze the top 10 items and provide insights.',
  tools: {
    analyzeItems: tool({
      inputSchema: z.object({ items: z.array(z.any()) }),
      execute: async ({ items }) => {
        const processed = processData(items); // Deterministic
        return { topItems: processed };
      },
    }),
  },
});
```

### 5. Progressive Enhancement

```typescript
// Start simple
const v1Agent = new Agent({
  model: 'openai/gpt-4o',
  system: 'Basic functionality',
  tools: { basicTool },
  stopWhen: stepCountIs(5),
});

// Add complexity gradually
const v2Agent = new Agent({
  model: 'openai/gpt-4o',
  system: 'Enhanced functionality with context awareness',
  tools: {
    basicTool,
    advancedTool,
  },
  stopWhen: [
    stepCountIs(10),
    customStopCondition,
  ],
  prepareStep: async ({ stepNumber, steps }) => {
    // Add dynamic behavior
    return {};
  },
});
```

### 6. Testing Strategies

```typescript
// Test tool execution independently
describe('SearchTool', () => {
  it('should return valid results', async () => {
    const result = await searchTool.execute({
      query: 'test query',
    });
    
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });
});

// Test agent behavior with mocked tools
describe('Agent', () => {
  it('should use tools correctly', async () => {
    const mockTool = tool({
      description: 'Mock tool',
      inputSchema: z.object({ input: z.string() }),
      execute: vi.fn().mockResolvedValue({ output: 'mocked' }),
    });

    const agent = new Agent({
      model: 'openai/gpt-4o',
      tools: { mockTool },
    });

    await agent.generate({ prompt: 'test' });
    
    expect(mockTool.execute).toHaveBeenCalled();
  });
});
```

### 7. Production Considerations

```typescript
// Add monitoring and logging
const productionAgent = new Agent({
  model: 'openai/gpt-4o',
  
  prepareStep: async (context) => {
    // Log step information
    console.log(`Step ${context.stepNumber}:`, {
      messageCount: context.messages.length,
      toolsAvailable: Object.keys(context.tools || {}).length,
    });
    
    return {};
  },
});

// Use with streaming and monitoring
const result = streamText({
  model: 'openai/gpt-4o',
  tools: { /* ... */ },
  
  onStepFinish: async (step) => {
    // Send metrics
    await sendMetrics({
      stepNumber: step.stepNumber,
      toolCallsCount: step.toolCalls?.length || 0,
      tokenUsage: step.usage,
      duration: step.duration,
    });
  },
  
  onFinish: async (result) => {
    // Log completion
    console.log('Agent finished:', {
      steps: result.steps.length,
      totalTokens: result.usage.totalTokens,
    });
  },
});
```

### 8. Cost Optimization

```typescript
// Implement budget controls
const costControlAgent = new Agent({
  model: 'openai/gpt-4o-mini', // Start with cheaper model
  
  stopWhen: [
    stepCountIs(20),
    budgetExceeded, // Custom budget check
  ],
  
  prepareStep: async ({ stepNumber, steps }) => {
    // Switch to cheaper model after initial steps
    if (stepNumber > 5) {
      return { model: 'openai/gpt-4o-mini' };
    }
    
    return {};
  },
});
```

---

## Code Examples

### Example 1: Research Agent with Search Tool

```typescript
import { Experimental_Agent as Agent, tool, stepCountIs } from 'ai';
import { z } from 'zod';

// Define search tool (integrate with Exa or similar)
const webSearch = tool({
  description: `Search the web for current information.
  
Use when the user asks about:
- Recent news, events, or current affairs
- Real-time data (stock prices, weather, sports)
- Facts that may have changed recently

Returns: Array of search results with title, content, and URL`,
  
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    numResults: z.number().optional().describe('Number of results (max 10)'),
  }),
  
  execute: async ({ query, numResults = 5 }) => {
    // Integrate with your search API (Exa, etc.)
    const results = await fetch('https://api.example.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, numResults }),
    }).then(res => res.json());
    
    return {
      results: results.map((r: any) => ({
        title: r.title,
        snippet: r.snippet,
        url: r.url,
      })),
    };
  },
});

// Create research agent
const researchAgent = new Agent({
  model: 'openai/gpt-4o',
  
  system: `You are a research assistant. Your role is to:
  1. Search for relevant information using the search tool
  2. Analyze the search results carefully
  3. Synthesize information from multiple sources
  4. Provide accurate, well-cited responses
  
  Always cite sources when making claims based on search results.`,
  
  tools: {
    search: webSearch,
  },
  
  stopWhen: stepCountIs(10),
});

// Use the agent
const result = await researchAgent.generate({
  prompt: 'What are the latest developments in quantum computing?',
});

console.log(result.text);
```

### Example 2: Multi-Tool Data Analysis Agent

```typescript
import { Experimental_Agent as Agent, tool, stepCountIs } from 'ai';
import { z } from 'zod';

// Define tools
const fetchData = tool({
  description: 'Fetch data from database',
  inputSchema: z.object({
    table: z.string(),
    filters: z.record(z.any()).optional(),
  }),
  execute: async ({ table, filters }) => {
    // Database query logic
    return { data: [] };
  },
});

const analyzeData = tool({
  description: 'Perform statistical analysis on data',
  inputSchema: z.object({
    data: z.array(z.any()),
    analysisType: z.enum(['summary', 'correlation', 'trend']),
  }),
  execute: async ({ data, analysisType }) => {
    // Analysis logic
    return { results: {} };
  },
});

const visualizeData = tool({
  description: 'Create data visualizations',
  inputSchema: z.object({
    data: z.array(z.any()),
    chartType: z.enum(['line', 'bar', 'pie', 'scatter']),
  }),
  execute: async ({ data, chartType }) => {
    // Visualization logic
    return { chartUrl: 'https://...' };
  },
});

// Create data analysis agent
const dataAgent = new Agent({
  model: 'openai/gpt-4o',
  
  system: `You are a data analyst. Follow this workflow:
  1. Fetch the requested data
  2. Analyze it thoroughly
  3. Create appropriate visualizations
  4. Provide insights and recommendations`,
  
  tools: {
    fetchData,
    analyzeData,
    visualizeData,
  },
  
  stopWhen: stepCountIs(15),
  
  prepareStep: async ({ stepNumber, steps }) => {
    // After fetching data, require analysis
    const hasFetchedData = steps.some(s => 
      s.toolCalls?.some(tc => tc.toolName === 'fetchData')
    );
    
    if (hasFetchedData && stepNumber < 10) {
      return {
        toolChoice: { type: 'tool', toolName: 'analyzeData' },
      };
    }
    
    return {};
  },
});
```

### Example 3: Customer Support Agent with Handoff

```typescript
import { Experimental_Agent as Agent, tool, stepCountIs } from 'ai';
import { z } from 'zod';

// Define tools
const checkOrderStatus = tool({
  description: 'Check the status of a customer order',
  inputSchema: z.object({
    orderId: z.string(),
  }),
  execute: async ({ orderId }) => {
    // Check order in system
    return {
      status: 'shipped',
      trackingNumber: 'TRACK123',
      estimatedDelivery: '2025-11-01',
    };
  },
});

const processRefund = tool({
  description: 'Process a refund request. Only use if the order qualifies.',
  inputSchema: z.object({
    orderId: z.string(),
    reason: z.string(),
  }),
  execute: async ({ orderId, reason }) => {
    // Process refund
    return {
      refundId: 'REF456',
      amount: 99.99,
      estimatedDays: 5,
    };
  },
});

const escalateToHuman = tool({
  description: 'Escalate complex issues to human support',
  inputSchema: z.object({
    issue: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  }),
  execute: async ({ issue, priority }) => {
    // Create support ticket
    return {
      ticketId: 'TICKET789',
      message: 'A human agent will contact you within 24 hours',
    };
  },
});

// Create support agent
const supportAgent = new Agent({
  model: 'openai/gpt-4o',
  
  system: `You are a customer support agent for an e-commerce platform.

Rules:
- Always be polite, empathetic, and professional
- Check order status before making promises
- Only process refunds if the order qualifies (not yet delivered or damaged)
- Escalate complex issues you cannot resolve
- Never share internal company information

Always confirm actions before executing them.`,
  
  tools: {
    checkOrderStatus,
    processRefund,
    escalateToHuman,
  },
  
  stopWhen: [
    stepCountIs(10),
    // Stop if escalated to human
    ({ steps }) => steps.some(s => 
      s.toolCalls?.some(tc => tc.toolName === 'escalateToHuman')
    ),
  ],
});
```

### Example 4: Code Generation Agent

```typescript
import { Experimental_Agent as Agent, tool, stepCountIs } from 'ai';
import { z } from 'zod';

const generateCode = tool({
  description: 'Generate code based on requirements',
  inputSchema: z.object({
    language: z.enum(['typescript', 'python', 'javascript']),
    description: z.string(),
    requirements: z.array(z.string()),
  }),
  execute: async ({ language, description, requirements }) => {
    // Use LLM or templates to generate code
    return {
      code: '// Generated code here',
      explanation: 'Code explanation',
    };
  },
});

const testCode = tool({
  description: 'Test generated code',
  inputSchema: z.object({
    code: z.string(),
    language: z.string(),
  }),
  execute: async ({ code, language }) => {
    // Run tests in sandbox
    return {
      passed: true,
      errors: [],
    };
  },
});

const improveCode = tool({
  description: 'Improve code based on test results',
  inputSchema: z.object({
    code: z.string(),
    errors: z.array(z.string()),
  }),
  execute: async ({ code, errors }) => {
    // Refine code
    return {
      improvedCode: '// Improved code',
    };
  },
});

const codeAgent = new Agent({
  model: 'openai/gpt-4o',
  
  system: `You are an expert software engineer. Follow this process:
  1. Understand requirements thoroughly
  2. Generate clean, well-documented code
  3. Test the code
  4. If tests fail, analyze errors and improve
  5. Iterate until tests pass`,
  
  tools: {
    generateCode,
    testCode,
    improveCode,
  },
  
  stopWhen: [
    stepCountIs(20),
    // Stop when tests pass
    ({ steps }) => {
      const lastTest = steps
        .flatMap(s => s.toolResults || [])
        .filter(r => r.toolName === 'testCode')
        .pop();
      
      return lastTest?.result?.passed === true;
    },
  ],
});
```

---

## Integration with External APIs

### Exa Search API Integration

Since you mentioned using Exa, here's a complete example of integrating it with the AI SDK:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

// Exa search tool
const exaSearch = tool({
  description: `Search the web using Exa's neural search engine.
  
Exa specializes in:
- Finding high-quality, relevant content
- Semantic search (understands meaning, not just keywords)
- Recent and accurate information
- Technical and research content

Use when:
- User needs current information not in your training data
- Query requires deep, technical knowledge
- Need to find specific articles, papers, or resources`,
  
  inputSchema: z.object({
    query: z.string().describe('Search query (natural language)'),
    numResults: z.number().optional().describe('Number of results (default: 5)'),
    useAutoprompt: z.boolean().optional().describe('Let Exa optimize the query'),
  }),
  
  execute: async ({ query, numResults = 5, useAutoprompt = true }) => {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.EXA_API_KEY!,
      },
      body: JSON.stringify({
        query,
        numResults,
        useAutoprompt,
        contents: {
          text: true,
        },
      }),
    });

    const data = await response.json();
    
    return {
      results: data.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        text: result.text,
        publishedDate: result.publishedDate,
      })),
    };
  },
});

// Exa find similar tool
const exaFindSimilar = tool({
  description: `Find content similar to a given URL using Exa.
  
Use when you need to:
- Find related articles or resources
- Discover similar content on a topic
- Get alternative perspectives`,
  
  inputSchema: z.object({
    url: z.string().describe('URL to find similar content for'),
    numResults: z.number().optional(),
  }),
  
  execute: async ({ url, numResults = 5 }) => {
    const response = await fetch('https://api.exa.ai/findSimilar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.EXA_API_KEY!,
      },
      body: JSON.stringify({
        url,
        numResults,
      }),
    });

    const data = await response.json();
    
    return {
      similarResults: data.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        score: result.score,
      })),
    };
  },
});

// Create agent with Exa integration
const exaAgent = new Agent({
  model: 'openai/gpt-4o',
  
  system: `You are a research assistant with access to Exa's neural search.
  
When using Exa:
- Use natural language queries (Exa understands semantic meaning)
- Cite sources with URLs
- If initial results aren't relevant, try rephrasing the query
- Use findSimilar to explore related content`,
  
  tools: {
    search: exaSearch,
    findSimilar: exaFindSimilar,
  },
  
  stopWhen: stepCountIs(10),
});
```

### REST API Integration Pattern

```typescript
// Generic REST API tool pattern
const apiTool = tool({
  description: 'Call external REST API',
  inputSchema: z.object({
    endpoint: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    body: z.record(z.any()).optional(),
  }),
  execute: async ({ endpoint, method, body }) => {
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_KEY}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      return {
        error: true,
        message: error.message,
      };
    }
  },
});
```

### Database Integration

```typescript
// Database query tool
const dbQuery = tool({
  description: 'Query the database',
  inputSchema: z.object({
    table: z.string(),
    operation: z.enum(['select', 'insert', 'update', 'delete']),
    conditions: z.record(z.any()).optional(),
    data: z.record(z.any()).optional(),
  }),
  execute: async ({ table, operation, conditions, data }) => {
    // Use your database client (Prisma, Drizzle, etc.)
    switch (operation) {
      case 'select':
        return await db.table(table).where(conditions).findMany();
      
      case 'insert':
        return await db.table(table).create({ data });
      
      case 'update':
        return await db.table(table).where(conditions).update({ data });
      
      case 'delete':
        return await db.table(table).where(conditions).delete();
      
      default:
        throw new Error('Unsupported operation');
    }
  },
});
```

---

## Summary

The Vercel AI SDK provides a comprehensive, type-safe toolkit for building AI agents. Key takeaways:

1. **Use the Agent Class** for most use cases - it reduces boilerplate and provides structure
2. **Write Clear Tool Descriptions** - they directly impact agent decision-making quality
3. **Leverage Loop Control** - `stopWhen` and `prepareStep` give you fine-grained control
4. **Start Simple, Iterate** - begin with basic functionality and add complexity gradually
5. **Handle Errors Gracefully** - implement robust error handling for production use
6. **Keep Agents Focused** - narrow, well-defined agents perform better than general-purpose ones
7. **Use Deterministic Code** - only use LLMs for tasks that require reasoning
8. **Monitor and Optimize** - track token usage, costs, and performance

### Next Steps

- Review the [official AI SDK documentation](https://ai-sdk.dev/docs)
- Explore [example templates](https://vercel.com/templates/ai)
- Join the [GitHub Discussions](https://github.com/vercel/ai/discussions)
- Experiment with different models and providers
- Build your first agent!

---

**Last Updated**: October 2025  
**AI SDK Version**: 5.x  
**Documentation Source**: Official Vercel AI SDK Documentation