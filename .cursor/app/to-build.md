Hi Ahmed Shahram, thanks for your application and for agreeing to do the assessment. Attached you
will find the information for the assessment.

General Requirements

Video Assessment: Please walk us through your approach to the task, clearly explaining your thought process. Highlight any challenges you encountered and discuss potential alternatives you considered. Show how you addressed these challenges and the reasoning behind your decisions.

film yourself from start to beginning

best case: upload your video as a g-drive file

audio is clearly understandable

video must be under 60 minutes

IDE: You are asked to use an Agentic IDE like Windsurf or Cursor to work on the task. We want to see how you utilize AI to generate high quality code efficiently.

LLM: Please use a local LLM instance or the Google Gemini Free Tier API

Node.js: The entire system should be built using Node.js.

Docker: The Weaviate vector database should be containerized and run in Docker.

Additional Libraries:

Weaviate JS client: For interacting with the Weaviate vector database.

LangGraph: For building the agent hierarchy.

Langchain: For LLM Communication and Abstraction

Part 1: Setup Weaviate Vector Database with Multi-TenancyRequirements:

Set up a Weaviate vector database using Docker.

Create a schema with multi-tenancy that includes fields:

fileId (string - Not vectorized or index searchable): The identifier for each file.

question (text): The question being asked.

answer (text): The answer to the question.

pageNumber (textArray): The pageNumber(s) this answer was derived from (imaginary)

Using the Weaviate JavaScript client:

Insert at least three fictional entries into the vector database. (You don’t have to provide a vector for the entries)

Part 2: LangGraph Hierarchical Agent SetupRequirements:

Set up a LangGraph agent hierarchy consisting of:

Delegating Agent: Determines the flow based on the user’s query. It decides whether to call the Chart.js tool, the RAG agent, or provide an answer directly to the user.

Chart.js Tool: A mocked tool that generates a Chart.js configuration based on input data.

RAG Agent: A retrieval-augmented generation agent that queries the vector database, retrieves relevant chunks, and returns them along with the answer to the user’s query.

Implement the Delegating Agent:

The delegating agent receives a user query and makes decisions based on the query. It decides whether:

To interact with the Chart.js tool and return a chart configuration.

To ask the RAG agent for relevant information.

Or to answer the user directly.

The delegating agent should be capable of calling both the Chart.js tool and RAG agent simultaneously or sequentially depending on the user’s request.

The Chart.js Tool:

The tool simply mocks generating a Chart.js configuration and returns it.

For simplicity, it can return a fixed mock configuration.

The RAG Agent:

Uses the Weaviate vector database to answer questions.

It fetches relevant chunks from the database and returns both the answer and the files used for the answer of the fetched objects.

The Agent should be able to reference specific files when giving an answer so a user can understand what file and page was used to answer the question. It should be in the format of “1- Page 3” when fileId 1 corresponds to the first fileId returned from the the agents data object.

If the embedding model isn’t available, the agent should use the fetchObjects API to retrieve the data.

Delegating Agent Response:

The final return schema for this agent should be a streamed response with this format

{
answer: string; //The streaming chunks of the agents aswer
data: object[]; //All references data objects (ChartJS Data or RAG References)
}
The delegating agent, when answering a user query, should always include:

The answer text.

All references used in a seperate data object

The fileIds and pages as reference objects if the response is based on RAG or database retrieval. Please decide yourself how and if you would group references with the same fileid but different page numbers

The Chart.js config if the response involves chart creation.

Integration and Handling Multiple Tools

The delegating agent needs to manage the simultaneous or sequential use of multiple tools:

If the user request requires both charting and data retrieval, the agent should be able to call the Chart.js tool and the RAG agent in parallel or sequentially.

The solution should ensure proper handling of both responses (from the chart tool and the RAG agent) and return them together in the final response.