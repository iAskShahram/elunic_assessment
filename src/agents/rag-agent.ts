import {
  StateGraph,
  START,
  END,
  Annotation,
  messagesStateReducer,
} from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { createLLM } from "../llm";
import { queryRAG, generateReferenceStrings } from "../tools/rag-tool";
import type { RAGReference, QADocument } from "../types";

/**
 * State annotation for RAG agent
 */
const RAGAgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  query: Annotation<string>(),
  documents: Annotation<QADocument[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),
  answer: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  references: Annotation<RAGReference[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),
});

type RAGAgentStateType = typeof RAGAgentState.State;

/**
 * Node: Retrieve documents from Weaviate
 */
async function retrieveDocuments(
  state: RAGAgentStateType
): Promise<Partial<RAGAgentStateType>> {
  const { query } = state;

  const { references } = await queryRAG(query);

  // Extract documents from references
  const documents: QADocument[] = references.map((ref) => ({
    fileId: ref.fileId,
    question: ref.question,
    answer: ref.answer,
    pageNumber: ref.pages,
  }));

  return {
    documents,
    references,
  };
}

/**
 * Node: Generate answer using LLM with retrieved context
 */
async function generateAnswer(
  state: RAGAgentStateType
): Promise<Partial<RAGAgentStateType>> {
  const { query, documents, references } = state;

  if (documents.length === 0) {
    return {
      answer:
        "I couldn't find any relevant information in the knowledge base to answer your question.",
      messages: [
        new AIMessage(
          "I couldn't find any relevant information in the knowledge base to answer your question."
        ),
      ],
    };
  }

  // Build context from documents
  const context = documents
    .map(
      (doc, i) =>
        `Document ${i + 1} (File: ${doc.fileId}, Pages: ${doc.pageNumber.join(", ")}):\nQ: ${doc.question}\nA: ${doc.answer}`
    )
    .join("\n\n");

  // Generate formatted references
  const formattedRefs = generateReferenceStrings(references);

  const llm = createLLM();

  const prompt = `You are a helpful assistant that answers questions based on the provided context.
Use the information from the context to answer the question. 
When referencing information, mention the source using the format provided in the references.

Context:
${context}

References (use these formats when citing):
${formattedRefs.join("\n")}

Question: ${query}

Provide a comprehensive answer based on the context. Include relevant citations using the reference format (e.g., "According to 1- Page 3...").`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const answerText =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  // Return only the first/best reference in the response
  const firstRef = references[0];
  return {
    answer: answerText,
    references: firstRef ? [firstRef] : [],
    messages: [new AIMessage(answerText)],
  };
}

/**
 * Create the RAG agent graph
 */
export function createRAGAgent() {
  const workflow = new StateGraph(RAGAgentState)
    .addNode("retrieve", retrieveDocuments)
    .addNode("generate", generateAnswer)
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "generate")
    .addEdge("generate", END);

  return workflow.compile();
}

/**
 * Run the RAG agent with a query
 */
export async function runRAGAgent(query: string): Promise<{
  answer: string;
  references: RAGReference[];
}> {
  const agent = createRAGAgent();

  const result = await agent.invoke({
    query,
    messages: [new HumanMessage(query)],
  });

  return {
    answer: result.answer,
    references: result.references,
  };
}

export { RAGAgentState };
export type { RAGAgentStateType };
