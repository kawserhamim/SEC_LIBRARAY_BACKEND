import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";
import { tavily } from "@tavily/core";
import NodeCache from "node-cache";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const chatCache = new NodeCache({ stdTTL: 60 * 60 * 24 }); //24hrs

export async function generate(userMessage, threadId) {
  const MAX_RETRIES = 10;
  let count = 0;
  try {
    const baseMessages = [
      {
        role: "system",
        content: `You are a helpful personal assistant with one tool: webSearch(query: string) — searches the internet for current or time-sensitive info.

Current date and time: ${new Date().toUTCString()}

Rules:
- Decide when to use your own knowledge and when to use tool
- Answer from your own knowledge for stable facts, explanations, and how-tos.
- Use webSearch for real-time, local, up-to-date information or something you don't know
- Keep search queries short (a few keywords, not full sentences).
- Synthesize search results into a natural answer, don't dump raw output.
- Do webSearch on any future event like next match, any next event
- When your response includes a list of items, always format it as a numbered list with each item on its own line. Do not write list items inline or separated by commas within a sentence.

Example:
1. Apple
2. Banana
3. Mango

Not like this: The items are 1. apple, 2. banana, and 3. mango.

Examples:
Q. What's the difference between TCP and UDP? 
A. answer directly (stable fact)
Q. How do I center a div in CSS? 
A. answer directly (general knowledge)
Q. What's the weather in Dhaka right now? 
A. searchWeb("weather Dhaka today")
Q. Who won the latest T20 World Cup? 
A. searchWeb("T20 World Cup winner latest")
Q. When is argentina's next match ?
A. searchWeb("Argentina's next fifa World Cup match")
  `,
      },
    ];

    const messages = chatCache.get(threadId) ?? baseMessages;

    messages.push({
      role: "user",
      content: userMessage,
    });

    //LLM Loop
    while (true) {
      if (count > MAX_RETRIES) {
        return "I could not find the result, Please try again later"; 
      }
      count++;
      // first LLM API call which gives in return of tool calling information
      const chatCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        messages: messages,
        //define the tool schema
        tools: [
          {
            type: "function",
            function: {
              name: "webSearch",
              description:
                "Search the latest information and realtime data on the internet", //what's the tool does
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "The search query to perform search on", //the description of the parameters
                  },
                },
                required: ["query"],
              },
            },
          },
        ],

        tool_choice: "auto",
      });
      messages.push(chatCompletion.choices[0].message);

      //calling tool on base of first LLM API
      const toolCalls = chatCompletion?.choices[0].message?.tool_calls;

      if (!toolCalls) {
        const reply = chatCompletion?.choices?.[0].message;
        chatCache.set(threadId, messages);
        // console.log(chatCache.data);

        return reply;
      }
      for (const tool of toolCalls) {
        // console.log("tool:", tool);
        const functionName = tool.function.name;
        const functionParams = tool.function.arguments;

        if (functionName === "webSearch") {
          const toolRes = await webSearch(JSON.parse(functionParams));
          // console.log(toolRes);
          messages.push({
            tool_call_id: tool.id,
            role: "tool",
            name: functionName,
            content: toolRes,
          });
          // console.log("tool info:::",tool.id, toolRes);
        }
      }
    }
  } catch (error) {
    console.log("Error calling LLM", error.message);
  }
}

async function webSearch({ query }) {
  console.log("Calling web search....");

  const response = await tvly.search(query, { maxResults: 3 });
  const finalResult = response.results.map((r) => r.content).join("\n\n");

  return finalResult;
}