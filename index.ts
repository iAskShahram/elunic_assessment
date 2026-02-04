import {
  runDelegatingAgent,
  streamDelegatingAgent,
} from "./src/agents/delegating-agent";
import {
  getWeaviateClient,
  closeWeaviateClient,
  initializeSchema,
} from "./src/db/weaviate";
import { seedDatabase } from "./src/db/seed";
import type { AgentResponse, ReferenceData } from "./src/types";

/**
 * Initialize the RAG system
 * - Connects to Weaviate
 * - Creates schema with multi-tenancy
 * - Seeds initial data if needed
 */
async function initializeSystem(): Promise<void> {
  console.log("🚀 Initializing RAG System...\n");

  try {
    await getWeaviateClient();
    console.log("✓ Connected to Weaviate");

    await initializeSchema();
    console.log("✓ Schema initialized");
  } catch (error) {
    console.error("Failed to initialize system:", error);
    throw error;
  }
}

/**
 * Run a query through the delegating agent (non-streaming)
 */
async function query(userQuery: string): Promise<AgentResponse> {
  const result = await runDelegatingAgent(userQuery);
  return {
    answer: result.answer,
    data: result.data,
  };
}

/**
 * Stream a query through the delegating agent
 * Yields chunks with answer text and/or data references
 */
async function* streamQuery(
  userQuery: string
): AsyncGenerator<{ answer?: string; data?: ReferenceData[]; status?: string }> {
  for await (const chunk of streamDelegatingAgent(userQuery)) {
    yield chunk;
  }
}

/**
 * Cleanup - close connections
 */
async function cleanup(): Promise<void> {
  await closeWeaviateClient();
  console.log("✓ Connections closed");
}

/**
 * Demo function to showcase the system
 */
async function demo() {
  console.log("=".repeat(60));
  console.log("RAG System with LangGraph - Demo");
  console.log("=".repeat(60));
  console.log();

  try {
    // Initialize the system
    await initializeSystem();
    console.log();

    // Example queries to demonstrate different routing paths
    const queries = [
      // RAG query
      "What is the company's annual revenue?",
      // Chart query
      "Create a bar chart showing quarterly revenue with values 100, 200, 150, 300",
      // Direct query
      "Hello, how are you?",
    ];

    for (const q of queries) {
      console.log("-".repeat(60));
      console.log(`📝 Query: "${q}"`);
      console.log("-".repeat(60));

      // Use streaming
      console.log("\n🔄 Streaming response...\n");

      let fullAnswer = "";
      let allData: ReferenceData[] = [];

      for await (const chunk of streamQuery(q)) {
        if (chunk.status) {
          console.log(`  [Status] ${chunk.status}`);
        }
        if (chunk.answer) {
          fullAnswer = chunk.answer;
        }
        if (chunk.data) {
          allData = [...allData, ...chunk.data];
        }
      }

      console.log("\n📤 Final Response:");
      console.log(JSON.stringify({ answer: fullAnswer, data: allData }, null, 2));
      console.log();
    }
  } catch (error) {
    console.error("Demo error:", error);
  } finally {
    await cleanup();
  }
}

/**
 * Seed the database with sample data
 */
async function seed() {
  try {
    await seedDatabase();
  } catch (error) {
    console.error("Seed error:", error);
  } finally {
    await closeWeaviateClient();
  }
}

// CLI handling
const args = process.argv.slice(2);
const command = args[0];

if (command === "demo") {
  demo();
} else if (command === "seed") {
  seed();
} else if (command === "query" && args[1]) {
  (async () => {
    try {
      await initializeSystem();
      const result = await query(args.slice(1).join(" "));
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("Error:", error);
    } finally {
      await cleanup();
    }
  })();
} else {
  console.log(`
RAG System with LangGraph Hierarchical Agents

Usage:
  bun run index.ts seed     - Seed the database with sample data
  bun run index.ts demo     - Run a demo with example queries
  bun run index.ts query <your question>  - Run a single query

Before running, ensure:
  1. Docker is running with Weaviate: docker-compose up -d
  2. GOOGLE_API_KEY is set in .env file

Example:
  docker-compose up -d
  bun run index.ts seed
  bun run index.ts demo
  bun run index.ts query "What is the company's revenue?"
`);
}

// Export for programmatic use
export { initializeSystem, query, streamQuery, cleanup, seedDatabase };
