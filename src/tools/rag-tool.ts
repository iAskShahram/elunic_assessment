import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchDocuments, fetchDocuments } from "../db/weaviate";
import type { RAGReference, QADocument } from "../types";

/**
 * Schema for RAG tool input
 */
const ragToolInputSchema = z.object({
  query: z.string().describe("The question or search query to find relevant documents"),
  tenant: z.string().optional().describe("The tenant to search within (defaults to 'default')"),
});

/**
 * Convert QA documents to RAG references with proper formatting
 */
function documentsToReferences(documents: QADocument[]): RAGReference[] {
  return documents.map((doc) => ({
    type: "rag" as const,
    fileId: doc.fileId,
    pages: doc.pageNumber,
    question: doc.question,
    answer: doc.answer,
  }));
}

/**
 * Format reference for display in answer
 * Format: "1- Page 3, 5" where 1 is the fileId index
 */
export function formatReferenceForAnswer(
  references: RAGReference[]
): Map<string, { index: number; pages: Set<string> }> {
  const fileIdMap = new Map<string, { index: number; pages: Set<string> }>();
  let fileIndex = 1;

  for (const ref of references) {
    if (!fileIdMap.has(ref.fileId)) {
      fileIdMap.set(ref.fileId, { index: fileIndex++, pages: new Set() });
    }
    const entry = fileIdMap.get(ref.fileId)!;
    ref.pages.forEach((page) => entry.pages.add(page));
  }

  return fileIdMap;
}

/**
 * Generate formatted reference strings
 */
export function generateReferenceStrings(
  references: RAGReference[]
): string[] {
  const fileIdMap = formatReferenceForAnswer(references);
  const result: string[] = [];

  fileIdMap.forEach(({ index, pages }) => {
    const sortedPages = Array.from(pages).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );
    result.push(`${index}- Page ${sortedPages.join(", ")}`);
  });

  return result;
}

/**
 * RAG tool that queries Weaviate for relevant documents
 * Uses BM25 search when available, falls back to fetchObjects
 */
export const ragTool = tool(
  async (input): Promise<{ references: RAGReference[]; formattedRefs: string[] }> => {
    const { query, tenant = "default" } = input;

    let documents: QADocument[];

    try {
      // Try BM25 search first
      documents = await searchDocuments(query, tenant, 5);
    } catch {
      // Fallback to fetchObjects if BM25 fails
      console.log("BM25 search failed, falling back to fetchObjects");
      documents = await fetchDocuments(tenant, 10);
    }

    if (documents.length === 0) {
      return {
        references: [],
        formattedRefs: [],
      };
    }

    const references = documentsToReferences(documents);
    const formattedRefs = generateReferenceStrings(references);

    return {
      references,
      formattedRefs,
    };
  },
  {
    name: "search_knowledge_base",
    description:
      "Search the knowledge base for relevant information to answer a question. Returns documents with their file IDs and page numbers.",
    schema: ragToolInputSchema,
  }
);

/**
 * Direct function to query RAG without using tool interface
 */
export async function queryRAG(
  query: string,
  tenant: string = "default"
): Promise<{ references: RAGReference[]; formattedRefs: string[] }> {
  let documents: QADocument[];

  try {
    documents = await searchDocuments(query, tenant, 5);
  } catch {
    console.log("BM25 search failed, falling back to fetchObjects");
    documents = await fetchDocuments(tenant, 10);
  }

  if (documents.length === 0) {
    return {
      references: [],
      formattedRefs: [],
    };
  }

  const references = documentsToReferences(documents);
  const formattedRefs = generateReferenceStrings(references);

  return {
    references,
    formattedRefs,
  };
}
