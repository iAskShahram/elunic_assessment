import {
  StateGraph,
  START,
  END,
  Annotation,
  messagesStateReducer,
} from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { createLLM } from "../llm";
import { runRAGAgent } from "./rag-agent";
import { createMockChartConfig } from "../tools/chartjs-tool";
import type {
  RAGReference,
  ChartJSData,
  ReferenceData,
  RoutingDecision,
} from "../types";

/**
 * State annotation for Delegating Agent
 */
const DelegatingAgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  query: Annotation<string>(),
  routingDecision: Annotation<RoutingDecision | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  ragResults: Annotation<RAGReference[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  chartResults: Annotation<ChartJSData | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  finalAnswer: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
  data: Annotation<ReferenceData[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

type DelegatingAgentStateType = typeof DelegatingAgentState.State;

/**
 * Node: Analyze query and determine routing
 */
async function routeQuery(
  state: DelegatingAgentStateType
): Promise<Partial<DelegatingAgentStateType>> {
  const { query } = state;
  const llm = createLLM();

  const routingPrompt = `You are a routing assistant. Analyze the user's query and determine how to handle it.

User Query: "${query}"

Respond with ONLY one of these options:
- "rag" - if the query asks about information, data, facts, or needs to search a knowledge base
- "chart" - if the query asks for a chart, graph, visualization, or visual representation of data
- "both" - if the query asks for both information AND a chart/visualization
- "direct" - if the query can be answered directly without searching or creating visuals (greetings, simple questions, etc.)

Your response must be exactly one word: rag, chart, both, or direct`;

  const response = await llm.invoke([new HumanMessage(routingPrompt)]);
  const decision = (
    typeof response.content === "string"
      ? response.content
      : String(response.content)
  )
    .toLowerCase()
    .trim() as RoutingDecision;

  // Validate the decision
  const validDecisions: RoutingDecision[] = ["rag", "chart", "both", "direct"];
  const finalDecision = validDecisions.includes(decision) ? decision : "direct";

  return {
    routingDecision: finalDecision,
  };
}

/**
 * Node: Execute RAG agent
 */
async function executeRAG(
  state: DelegatingAgentStateType,
  config?: LangGraphRunnableConfig
): Promise<Partial<DelegatingAgentStateType>> {
  const { query } = state;

  // Stream progress update
  if (config?.writer) {
    config.writer({ status: "Searching knowledge base..." });
  }

  const { answer, references } = await runRAGAgent(query);

  // Return only the first/best reference in the data field
  const firstRef = references[0];
  const data: ReferenceData[] = firstRef ? [firstRef] : [];

  return {
    ragResults: references,
    finalAnswer: answer,
    data,
  };
}

/**
 * Node: Execute Chart.js tool
 */
async function executeChart(
  state: DelegatingAgentStateType,
  config?: LangGraphRunnableConfig
): Promise<Partial<DelegatingAgentStateType>> {
  const { query } = state;

  // Stream progress update
  if (config?.writer) {
    config.writer({ status: "Generating chart configuration..." });
  }

  const llm = createLLM();

  // Extract chart parameters from query
  const extractPrompt = `Extract chart parameters from this query: "${query}"

Respond in JSON format:
{
  "chartType": "bar" | "line" | "pie" | "doughnut",
  "title": "chart title",
  "labels": ["label1", "label2", ...],
  "dataValues": [number1, number2, ...],
  "datasetLabel": "dataset label"
}

If specific values aren't mentioned, use reasonable defaults based on the query context.`;

  try {
    const response = await llm.invoke([new HumanMessage(extractPrompt)]);
    const responseText =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    // Try to parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const params = JSON.parse(jsonMatch[0]);
      const chartData = createMockChartConfig(
        params.chartType || "bar",
        params.title || "Generated Chart",
        params.labels || ["A", "B", "C", "D"],
        params.dataValues || [10, 20, 30, 40],
        params.datasetLabel || "Data"
      );

      return {
        chartResults: chartData,
        data: [chartData],
      };
    }
  } catch {
    // Fallback to default chart
  }

  // Default chart if extraction fails
  const chartData = createMockChartConfig(
    "bar",
    "Sample Data Visualization",
    ["Q1", "Q2", "Q3", "Q4"],
    [100, 200, 150, 300],
    "Revenue"
  );

  return {
    chartResults: chartData,
    data: [chartData],
  };
}

/**
 * Node: Generate direct answer
 */
async function generateDirectAnswer(
  state: DelegatingAgentStateType,
  config?: LangGraphRunnableConfig
): Promise<Partial<DelegatingAgentStateType>> {
  const { query } = state;

  if (config?.writer) {
    config.writer({ status: "Generating response..." });
  }

  const llm = createLLM();

  const response = await llm.invoke([
    new HumanMessage(
      `You are a helpful assistant. Please respond to: "${query}"`
    ),
  ]);
  const answer =
    typeof response.content === "string"
      ? response.content
      : String(response.content);

  return {
    finalAnswer: answer,
    messages: [new AIMessage(answer)],
  };
}

/**
 * Node: Combine results from multiple sources
 */
async function combineResults(
  state: DelegatingAgentStateType,
  config?: LangGraphRunnableConfig
): Promise<Partial<DelegatingAgentStateType>> {
  const { query, ragResults, chartResults, finalAnswer } = state;

  if (config?.writer) {
    config.writer({ status: "Combining results..." });
  }

  // If we already have a final answer (from RAG or direct), use it
  if (finalAnswer && !chartResults) {
    return {
      messages: [new AIMessage(finalAnswer)],
    };
  }

  // If we have both RAG and chart results, combine them
  if (ragResults.length > 0 && chartResults) {
    const llm = createLLM();

    const combinePrompt = `Based on the following information, provide a comprehensive answer that combines the data insights with a reference to the chart.

Question: ${query}

RAG Results Summary:
${ragResults.map((r) => `- ${r.answer} (Source: ${r.fileId}, Pages: ${r.pages.join(", ")})`).join("\n")}

A chart has also been generated to visualize the data.

Provide a response that:
1. Summarizes the key information found
2. References the sources using format like "1- Page X"
3. Mentions that a chart is available for visualization`;

    const response = await llm.invoke([new HumanMessage(combinePrompt)]);
    const combinedAnswer =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return {
      finalAnswer: combinedAnswer,
      messages: [new AIMessage(combinedAnswer)],
    };
  }

  // If only chart results
  if (chartResults) {
    const answer = `I've generated a ${chartResults.config.type} chart titled "${chartResults.config.options?.plugins?.title?.text || "Chart"}" based on your request. The chart configuration is included in the response data.`;
    return {
      finalAnswer: answer,
      messages: [new AIMessage(answer)],
    };
  }

  return {};
}

/**
 * Conditional routing based on decision
 */
function routeBasedOnDecision(
  state: DelegatingAgentStateType
): "rag" | "chart" | "direct" | "both_rag" {
  const { routingDecision } = state;

  switch (routingDecision) {
    case "rag":
      return "rag";
    case "chart":
      return "chart";
    case "both":
      return "both_rag";
    case "direct":
      return "direct";
    default:
      return "direct";
  }
}

/**
 * Route after RAG execution in "both" mode
 */
function routeAfterBothRAG(): "both_chart" {
  return "both_chart";
}

/**
 * Create the Delegating Agent graph
 */
export function createDelegatingAgent() {
  const workflow = new StateGraph(DelegatingAgentState)
    // Add nodes
    .addNode("route", routeQuery)
    .addNode("rag", executeRAG)
    .addNode("chart", executeChart)
    .addNode("direct", generateDirectAnswer)
    .addNode("both_rag", executeRAG)
    .addNode("both_chart", executeChart)
    .addNode("combine", combineResults)
    // Add edges
    .addEdge(START, "route")
    .addConditionalEdges("route", routeBasedOnDecision, {
      rag: "rag",
      chart: "chart",
      direct: "direct",
      both_rag: "both_rag",
    })
    .addEdge("rag", "combine")
    .addEdge("chart", "combine")
    .addEdge("direct", END)
    .addConditionalEdges("both_rag", routeAfterBothRAG, {
      both_chart: "both_chart",
    })
    .addEdge("both_chart", "combine")
    .addEdge("combine", END);

  return workflow.compile();
}

/**
 * Run the delegating agent with a query
 */
export async function runDelegatingAgent(query: string): Promise<{
  answer: string;
  data: ReferenceData[];
}> {
  const agent = createDelegatingAgent();

  const result = await agent.invoke({
    query,
    messages: [new HumanMessage(query)],
  });

  return {
    answer: result.finalAnswer,
    data: result.data,
  };
}

/**
 * Stream the delegating agent response
 */
export async function* streamDelegatingAgent(
  query: string
): AsyncGenerator<{ answer?: string; data?: ReferenceData[]; status?: string }> {
  const agent = createDelegatingAgent();

  for await (const chunk of await agent.stream(
    {
      query,
      messages: [new HumanMessage(query)],
    },
    {
      streamMode: ["updates", "custom"],
    }
  )) {
    // Handle different stream modes
    if (Array.isArray(chunk)) {
      const [mode, data] = chunk;
      if (mode === "custom" && data.status) {
        yield { status: data.status };
      } else if (mode === "updates") {
        // Check for final state updates
        for (const [, nodeUpdate] of Object.entries(data)) {
          const update = nodeUpdate as Partial<DelegatingAgentStateType>;
          if (update.finalAnswer) {
            yield { answer: update.finalAnswer };
          }
          if (update.data && update.data.length > 0) {
            yield { data: update.data };
          }
        }
      }
    } else {
      // Single update object
      for (const [, nodeUpdate] of Object.entries(chunk)) {
        const update = nodeUpdate as Partial<DelegatingAgentStateType>;
        if (update.finalAnswer) {
          yield { answer: update.finalAnswer };
        }
        if (update.data && update.data.length > 0) {
          yield { data: update.data };
        }
      }
    }
  }
}

export { DelegatingAgentState };
export type { DelegatingAgentStateType };
