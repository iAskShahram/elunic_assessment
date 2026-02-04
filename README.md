# RAG System with LangGraph Hierarchical Agents

A RAG (Retrieval-Augmented Generation) system built with LangGraph, featuring a hierarchical agent architecture that can route queries to different tools including a RAG agent and Chart.js generator.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Query                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Delegating Agent                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Routing Decision                         │   │
│  │   • rag     → Search knowledge base                  │   │
│  │   • chart   → Generate Chart.js config               │   │
│  │   • both    → Execute both in parallel               │   │
│  │   • direct  → Answer directly                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│ RAG Agent │  │ Chart.js  │  │  Direct   │
│           │  │   Tool    │  │  Answer   │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │
      ▼              │              │
┌───────────┐        │              │
│ Weaviate  │        │              │
│ (Docker)  │        │              │
└───────────┘        │              │
      │              │              │
      └──────────────┼──────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Streamed Response                           │
│  { answer: string, data: ReferenceData[] }                  │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Weaviate Vector Database**: Multi-tenancy enabled, containerized with Docker
- **LangGraph Agent Hierarchy**: Delegating agent routes to specialized tools
- **RAG Agent**: Queries Weaviate and returns answers with file/page references
- **Chart.js Tool**: Generates Chart.js configurations from natural language
- **Streaming Responses**: Real-time streaming of answer chunks and data
- **Google Gemini LLM**: Uses Gemini 1.5 Flash for inference

## Prerequisites

- [Bun](https://bun.sh/) runtime
- [Docker](https://www.docker.com/) for Weaviate
- Google API Key (Gemini)

## Setup

1. **Clone and install dependencies**:
   ```bash
   bun install
   ```

2. **Set up environment variables**:
   ```bash
   # Create .env file
   echo "GOOGLE_API_KEY=your_api_key_here" > .env
   ```

3. **Start Weaviate**:
   ```bash
   bun run docker:up
   # or
   docker-compose up -d
   ```

4. **Seed the database**:
   ```bash
   bun run seed
   ```

## Usage

### Demo Mode
Run example queries showcasing different routing paths:
```bash
bun run demo
```

### Single Query
```bash
bun run query "What is the company's annual revenue?"
```

### Programmatic Usage
```typescript
import { initializeSystem, query, streamQuery, cleanup } from "./index";

// Initialize
await initializeSystem();

// Non-streaming query
const result = await query("What are the key product features?");
console.log(result.answer);
console.log(result.data);

// Streaming query
for await (const chunk of streamQuery("Create a chart of quarterly revenue")) {
  if (chunk.status) console.log("Status:", chunk.status);
  if (chunk.answer) console.log("Answer:", chunk.answer);
  if (chunk.data) console.log("Data:", chunk.data);
}

// Cleanup
await cleanup();
```

## Response Format

```typescript
interface AgentResponse {
  answer: string;        // The generated answer text
  data: ReferenceData[]; // Array of references (RAG or Chart.js)
}

// RAG Reference
interface RAGReference {
  type: "rag";
  fileId: string;
  pages: string[];
  question: string;
  answer: string;
}

// Chart.js Reference
interface ChartJSData {
  type: "chartjs";
  config: ChartJSConfig;
}
```

## File Structure

```
.
├── docker-compose.yml          # Weaviate container config
├── index.ts                    # Main entry point
├── package.json
└── src/
    ├── agents/
    │   ├── delegating-agent.ts # Main router agent
    │   ├── rag-agent.ts        # RAG retrieval agent
    │   └── index.ts
    ├── db/
    │   ├── weaviate.ts         # Weaviate client & schema
    │   ├── seed.ts             # Sample data seeding
    │   └── index.ts
    ├── tools/
    │   ├── chartjs-tool.ts     # Chart.js generator
    │   ├── rag-tool.ts         # Weaviate query tool
    │   └── index.ts
    ├── llm.ts                  # Google Gemini setup
    ├── types.ts                # TypeScript types
    └── index.ts                # Module exports
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run demo` | Run demo with example queries |
| `bun run seed` | Seed database with sample data |
| `bun run query <question>` | Run a single query |
| `bun run docker:up` | Start Weaviate container |
| `bun run docker:down` | Stop Weaviate container |
| `bun run docker:logs` | View Weaviate logs |

## Multi-Tenancy

The Weaviate schema supports multi-tenancy. By default, all operations use the "default" tenant. To use a different tenant:

```typescript
import { searchDocuments, fetchDocuments } from "./src/db/weaviate";

// Search in a specific tenant
const results = await searchDocuments("query", "tenant-name");
```

## License

MIT
