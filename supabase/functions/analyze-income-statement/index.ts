
// Note: To use npm modules in Supabase Edge Functions, you need to import them from a CDN like esm.sh.
import { GoogleGenAI, Type } from "npm:@google/genai";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Fix for TypeScript error when Deno global is not recognized.
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

// Define CORS headers to allow the web app to call this function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to format the report data into a human-readable string for the AI prompt
const formatReportDataForPrompt = (rows: any[], depth = 0): string => {
  let result = "";
  const indent = " ".repeat(depth * 2);

  for (const row of rows) {
    const currentValue = row.currentPeriod !== null ? Number(row.currentPeriod).toLocaleString("vi-VN") : "N/A";
    const previousValue = row.previousPeriod !== null ? Number(row.previousPeriod).toLocaleString("vi-VN") : "N/A";
    
    result += `${indent}- ${row.name}: \n`;
    result += `${indent}  - Kỳ này: ${currentValue}\n`;
    result += `${indent}  - Cùng kỳ năm trước: ${previousValue}\n`;

    if (row.children && row.children.length > 0) {
      result += formatReportDataForPrompt(row.children, depth + 1);
    }
  }
  return result;
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Ensure the Gemini API key is set in Supabase secrets
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in Supabase environment variables.");
    }
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const { reportData, currentPeriod, previousPeriod } = await req.json();

    if (!reportData || !currentPeriod || !previousPeriod) {
        return new Response(JSON.stringify({ error: "Missing required parameters: reportData, currentPeriod, previousPeriod." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const formattedData = formatReportDataForPrompt(reportData);
    
    const systemInstruction = `You are a senior business performance analyst. Your task is to analyze an Income Statement and provide insightful commentary in Vietnamese.
    Focus on business performance, profitability, revenue trends, and cost management. Provide clear, actionable insights for management.
    Only respond with a valid JSON object matching the provided schema. Do not add any markdown formatting like \`\`\`json.`;
    
    const prompt = `
      Please analyze the Income Statement below for the periods ending on ${currentPeriod} (Kỳ này) and ${previousPeriod} (Cùng kỳ năm trước).
      The data is provided here:

      ${formattedData}

      Based on the data, provide:
      1.  **General Comments:** Key observations about business performance, profitability, and changes between the two periods.
      2.  **Risk Warnings:** Identify any worrying trends such as declining revenue, shrinking margins, or escalating costs.
      3.  **Actionable Suggestions:** Provide specific recommendations to improve profitability and operational efficiency.

      Use HTML <b>...</b> tags to highlight important terms or numbers where appropriate.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
          comments: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key comments on business performance, profitability, and changes between periods.",
          },
          risks: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Potential risks or worrying trends like declining revenue or shrinking margins.",
          },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Specific action recommendations for management to improve performance.",
          },
        },
        required: ["comments", "risks", "suggestions"],
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.5,
        }
    });
    
    const resultJson = JSON.parse(response.text);

    return new Response(JSON.stringify(resultJson), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error during analysis:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});