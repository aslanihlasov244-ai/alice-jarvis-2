import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic'; 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Получаем текст пользователя
    const userMessage = body?.request?.command?.trim() || 
                        body?.request?.original_utterance?.trim();

    // Приветствие при старте навыка
    if (!userMessage) {
      return new Response(JSON.stringify({
        response: { text: "Привет! Я твой умный помощник Мой Джарвис. О чём поговорим?", end_session: false },
        session_state: {},
        version: "1.0",
      }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
       console.error("GEMINI_API_KEY is missing!");
       return new Response(JSON.stringify({
         response: { text: "Ошибка конфигурации сервера.", end_session: true },
         session_state: {},
         version: "1.0",
       }), { 
         status: 200, 
         headers: { ...corsHeaders, "Content-Type": "application/json" } 
       });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "Ты друг ребенка. Отвечай очень коротко (до 10 слов), весело и понятно."
    });

    const result = await model.generateContent(userMessage);
    const responseText = result.response.text().trim();

    return new Response(JSON.stringify({
      response: { text: responseText || "Я тут!", end_session: false },
      session_state: {},
      version: "1.0",
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Server Error:", error.message);
    return new Response(JSON.stringify({
      response: { text: "Что-то пошло не так...", end_session: false },
      session_state: {},
      version: "1.0",
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}
