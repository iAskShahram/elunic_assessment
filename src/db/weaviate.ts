import weaviate, { type WeaviateClient } from "weaviate-client";

const COLLECTION_NAME = "QADocument";
const DEFAULT_TENANT = "default";

let client: WeaviateClient | null = null;

/**
 * Get or create the Weaviate client connection
 */
export async function getWeaviateClient(): Promise<WeaviateClient> {
  if (client) return client;

  client = await weaviate.connectToLocal({
    host: "localhost",
    port: 8080,
    grpcPort: 50051,
  });

  return client;
}

/**
 * Close the Weaviate client connection
 */
export async function closeWeaviateClient(): Promise<void> {
  if (client) {
    client.close();
    client = null;
  }
}

/**
 * Initialize the QADocument collection with multi-tenancy enabled
 */
export async function initializeSchema(): Promise<void> {
  const weaviateClient = await getWeaviateClient();

  // Check if collection already exists
  const exists = await weaviateClient.collections.exists(COLLECTION_NAME);

  if (exists) {
    console.log(`Collection '${COLLECTION_NAME}' already exists`);
    return;
  }

  // Create collection with multi-tenancy enabled
  await weaviateClient.collections.create({
    name: COLLECTION_NAME,
    multiTenancy: weaviate.configure.multiTenancy({
      enabled: true,
      autoTenantCreation: true,
    }),
    properties: [
      {
        name: "fileId",
        dataType: "text" as const,
        skipVectorization: true,
        indexFilterable: true,
        indexSearchable: false,
      },
      {
        name: "question",
        dataType: "text" as const,
        skipVectorization: true,
      },
      {
        name: "answer",
        dataType: "text" as const,
        skipVectorization: true,
      },
      {
        name: "pageNumber",
        dataType: "text[]" as const,
        skipVectorization: true,
      },
    ],
    // Disable vectorization since we're not using embedding model
    vectorizers: [],
  });

  console.log(`Collection '${COLLECTION_NAME}' created with multi-tenancy`);

  // Create default tenant
  const collection = weaviateClient.collections.get(COLLECTION_NAME);
  await collection.tenants.create([{ name: DEFAULT_TENANT }]);
  console.log(`Default tenant '${DEFAULT_TENANT}' created`);
}

/**
 * Get the QADocument collection for a specific tenant
 */
export function getCollection(tenantName: string = DEFAULT_TENANT) {
  if (!client) {
    throw new Error("Weaviate client not initialized. Call getWeaviateClient() first.");
  }
  return client.collections.get(COLLECTION_NAME).withTenant(tenantName);
}

/**
 * Query documents from Weaviate using fetchObjects (no vector search)
 */
export async function fetchDocuments(
  tenantName: string = DEFAULT_TENANT,
  limit: number = 10
) {
  const collection = getCollection(tenantName);

  const result = await collection.query.fetchObjects({
    limit,
    returnProperties: ["fileId", "question", "answer", "pageNumber"],
  });

  return result.objects.map((obj) => ({
    fileId: obj.properties.fileId as string,
    question: obj.properties.question as string,
    answer: obj.properties.answer as string,
    pageNumber: obj.properties.pageNumber as string[],
  }));
}

/**
 * Search documents by matching question text (BM25 search)
 */
export async function searchDocuments(
  query: string,
  tenantName: string = DEFAULT_TENANT,
  limit: number = 5
) {
  const collection = getCollection(tenantName);

  const result = await collection.query.bm25(query, {
    limit,
    queryProperties: ["question", "answer"],
    returnProperties: ["fileId", "question", "answer", "pageNumber"],
  });

  return result.objects.map((obj) => ({
    fileId: obj.properties.fileId as string,
    question: obj.properties.question as string,
    answer: obj.properties.answer as string,
    pageNumber: obj.properties.pageNumber as string[],
  }));
}

export { COLLECTION_NAME, DEFAULT_TENANT };
