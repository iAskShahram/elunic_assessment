import {
  getWeaviateClient,
  initializeSchema,
  getCollection,
  closeWeaviateClient,
  DEFAULT_TENANT,
} from "./weaviate";

/**
 * Fictional QA entries for seeding the database
 */
const SEED_DATA = [
  {
    fileId: "file-001",
    question: "What is the company's annual revenue for 2024?",
    answer:
      "The company's annual revenue for 2024 was $4.2 billion, representing a 15% increase from the previous year. The growth was primarily driven by expansion in the cloud services division and increased enterprise adoption.",
    pageNumber: ["3", "4"],
  },
  {
    fileId: "file-002",
    question: "What are the key features of the new product line?",
    answer:
      "The new product line includes three key features: AI-powered automation, real-time analytics dashboard, and seamless third-party integrations. Each feature is designed to improve operational efficiency by up to 40%.",
    pageNumber: ["7"],
  },
  {
    fileId: "file-001",
    question: "What is the employee growth projection for next year?",
    answer:
      "The company projects to hire 500 new employees next year, focusing primarily on engineering (200 positions), sales (150 positions), and customer support (150 positions). This represents a 25% workforce expansion.",
    pageNumber: ["12", "13", "14"],
  },
];

/**
 * Seed the database with fictional QA entries
 */
export async function seedDatabase(): Promise<void> {
  console.log("Connecting to Weaviate...");
  await getWeaviateClient();

  console.log("Initializing schema...");
  await initializeSchema();

  console.log("Seeding database with fictional entries...");
  const collection = getCollection(DEFAULT_TENANT);

  // Insert each entry
  for (const entry of SEED_DATA) {
    await collection.data.insert({
      properties: {
        fileId: entry.fileId,
        question: entry.question,
        answer: entry.answer,
        pageNumber: entry.pageNumber,
      },
    });
    console.log(`  Inserted: "${entry.question.substring(0, 50)}..."`);
  }

  console.log(`\nSuccessfully seeded ${SEED_DATA.length} entries!`);
}

/**
 * Run seed if executed directly
 */
async function main() {
  try {
    await seedDatabase();
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await closeWeaviateClient();
  }
}

// Execute if run directly (only when this file is the main module)
if (import.meta.main) {
  main();
}
