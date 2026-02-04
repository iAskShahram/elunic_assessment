import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { ChartJSConfig, ChartJSData } from "../types";

/**
 * Schema for Chart.js tool input
 */
const chartJsInputSchema = z.object({
  chartType: z
    .enum(["bar", "line", "pie", "doughnut"])
    .describe("The type of chart to generate"),
  title: z.string().describe("The title for the chart"),
  labels: z.array(z.string()).describe("Labels for the chart data points"),
  dataValues: z.array(z.number()).describe("Numeric values for the chart"),
  datasetLabel: z.string().describe("Label for the dataset"),
});

/**
 * Generate mock colors for chart datasets
 */
function generateColors(count: number): string[] {
  const colors = [
    "rgba(255, 99, 132, 0.8)",
    "rgba(54, 162, 235, 0.8)",
    "rgba(255, 206, 86, 0.8)",
    "rgba(75, 192, 192, 0.8)",
    "rgba(153, 102, 255, 0.8)",
    "rgba(255, 159, 64, 0.8)",
    "rgba(199, 199, 199, 0.8)",
    "rgba(83, 102, 255, 0.8)",
  ];
  return colors.slice(0, count);
}

/**
 * Mocked Chart.js tool that generates a Chart.js configuration
 */
export const chartJsTool = tool(
  async (input): Promise<ChartJSData> => {
    const { chartType, title, labels, dataValues, datasetLabel } = input;

    const isPieOrDoughnut = chartType === "pie" || chartType === "doughnut";

    const config: ChartJSConfig = {
      type: chartType,
      data: {
        labels,
        datasets: [
          {
            label: datasetLabel,
            data: dataValues,
            backgroundColor: isPieOrDoughnut
              ? generateColors(dataValues.length)
              : "rgba(54, 162, 235, 0.8)",
            borderColor: isPieOrDoughnut
              ? generateColors(dataValues.length).map((c) =>
                  c.replace("0.8", "1")
                )
              : "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: isPieOrDoughnut ? "right" : "top",
          },
          title: {
            display: true,
            text: title,
          },
        },
      },
    };

    return {
      type: "chartjs",
      config,
    };
  },
  {
    name: "generate_chart",
    description:
      "Generate a Chart.js configuration for visualizing data. Use this tool when the user asks for a chart, graph, or visualization of data.",
    schema: chartJsInputSchema,
  }
);

/**
 * Create a mock chart response without using the tool
 * Useful for testing or when tool calling is not available
 */
export function createMockChartConfig(
  chartType: "bar" | "line" | "pie" | "doughnut" = "bar",
  title: string = "Sample Chart",
  labels: string[] = ["Q1", "Q2", "Q3", "Q4"],
  dataValues: number[] = [100, 200, 150, 300],
  datasetLabel: string = "Data"
): ChartJSData {
  const isPieOrDoughnut = chartType === "pie" || chartType === "doughnut";

  return {
    type: "chartjs",
    config: {
      type: chartType,
      data: {
        labels,
        datasets: [
          {
            label: datasetLabel,
            data: dataValues,
            backgroundColor: isPieOrDoughnut
              ? generateColors(dataValues.length)
              : "rgba(54, 162, 235, 0.8)",
            borderColor: isPieOrDoughnut
              ? generateColors(dataValues.length).map((c) =>
                  c.replace("0.8", "1")
                )
              : "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: isPieOrDoughnut ? "right" : "top" },
          title: { display: true, text: title },
        },
      },
    },
  };
}
