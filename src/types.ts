import type { BaseMessage } from "@langchain/core/messages";

/**
 * RAG reference with file and page information
 */
export interface RAGReference {
  type: "rag";
  fileId: string;
  pages: string[];
  question: string;
  answer: string;
}

/**
 * Chart.js configuration data
 */
export interface ChartJSData {
  type: "chartjs";
  config: ChartJSConfig;
}

/**
 * Chart.js configuration object
 */
export interface ChartJSConfig {
  type: "bar" | "line" | "pie" | "doughnut";
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
    }>;
  };
  options?: {
    responsive?: boolean;
    plugins?: {
      legend?: { position?: string };
      title?: { display?: boolean; text?: string };
    };
  };
}

/**
 * Union type for all reference data types
 */
export type ReferenceData = RAGReference | ChartJSData;

/**
 * Final response format from the delegating agent
 */
export interface AgentResponse {
  answer: string;
  data: ReferenceData[];
}

/**
 * Document retrieved from Weaviate
 */
export interface QADocument {
  fileId: string;
  question: string;
  answer: string;
  pageNumber: string[];
}

/**
 * State for the delegating agent graph
 */
export interface DelegatingAgentState {
  messages: BaseMessage[];
  query: string;
  routingDecision: "rag" | "chart" | "direct" | "both" | null;
  ragResults: RAGReference[];
  chartResults: ChartJSData | null;
  finalAnswer: string;
  data: ReferenceData[];
}

/**
 * State for the RAG agent subgraph
 */
export interface RAGAgentState {
  messages: BaseMessage[];
  query: string;
  documents: QADocument[];
  answer: string;
  references: RAGReference[];
}

/**
 * Tool routing decision from the delegating agent
 */
export type RoutingDecision = "rag" | "chart" | "direct" | "both";

/**
 * Format RAG references for display
 * Groups by fileId and formats as "1- Page 3, 5"
 */
export function formatRAGReferences(references: RAGReference[]): string {
  const grouped = new Map<string, Set<string>>();

  references.forEach((ref, index) => {
    const displayId = (index + 1).toString();
    if (!grouped.has(ref.fileId)) {
      grouped.set(ref.fileId, new Set());
    }
    ref.pages.forEach((page) => grouped.get(ref.fileId)!.add(page));
  });

  const formatted: string[] = [];
  let counter = 1;

  grouped.forEach((pages, _fileId) => {
    const sortedPages = Array.from(pages).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );
    formatted.push(`${counter}- Page ${sortedPages.join(", ")}`);
    counter++;
  });

  return formatted.join("\n");
}
