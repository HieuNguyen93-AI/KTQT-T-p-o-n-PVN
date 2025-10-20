
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
    const endValue = row.endPeriod !== null ? Number(row.endPeriod).toLocaleString("vi-VN") : "N/A";
    const startValue = row.startPeriod !== null ? Number(row.startPeriod).toLocaleString("vi-VN") : "N/A";
    
    result += `${indent}- ${row.name}: \n`;
    result += `${indent}  - Cuối kỳ: ${endValue}\n`;
    result += `${indent}  - Đầu kỳ: ${startValue}\n`;

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

    const { reportData, startPeriod, endPeriod } = await req.json();

    if (!reportData || !startPeriod || !endPeriod) {
        return new Response(JSON.stringify({ error: "Missing required parameters: reportData, startPeriod, endPeriod." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const formattedData = formatReportDataForPrompt(reportData);
    
    const systemInstruction = `You are a senior financial analyst. Your task is to analyze Balance Sheet data and provide insightful commentary in Vietnamese.
    Focus on providing useful, easy-to-understand information for management.
    Only respond with a valid JSON object matching the provided schema. Do not add any markdown formatting like \`\`\`json.`;
    
    const prompt = `
      Please analyze the Balance Sheet below for the periods ending on ${endPeriod} (End Period) and ${startPeriod} (Start Period).
      The data is provided here:

      ${formattedData}

      Based on the data, provide:
      1.  **General Comments:** Key observations about the financial position and changes between the two periods.
      2.  **Risk Warnings:** Identify any worrying trends or potential risk factors.
      3.  **Actionable Suggestions:** Provide specific recommendations for management.

      Use HTML <b>...</b> tags to highlight important terms or numbers where appropriate.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
          comments: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key comments on the financial situation and changes between the two periods.",
          },
          risks: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Potential risks or worrying signs (e.g., high debt, low liquidity).",
          },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Specific action recommendations for management based on the analysis.",
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
    
    // Gemini returns the result as a text string, which needs to be parsed into JSON
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