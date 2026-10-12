import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "edge";

export async function POST(request) {
  try {
    // Безопасное чтение JSON для любых версий Next.js и Vercel Edge
    let body;
    if (typeof request.json === "function") {
      body = await request.json();
    } else if (typeof request.text === "function") {
      const text = await request.text();
      body = JSON.parse(text);
    } else {
      body = request.body;
    }

    const userMessage = body?.request?.command?.trim() || body?.request?.original_utterance?.trim();

    // Если это первый запуск навыка (приветствие от Алисы)
    if (!userMessage) {
      return new Response(
        JSON.stringify({
          response: { text: "Привет! Я твой умный голосовой помощник Мой торе. О чём ты хочешь поговорить?", end_session: false },
          session_state: body?.state?.session || {},
          version: "1.0",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          response: { text: "Сервис временно недоступен. Проверьте ключ API.", end_session: false },
          session_state: body?.state?.session || {},
          version: "1.0",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const previousState = body?.state?.session || {};
    const history = Array.isArray(previousState.history) ? previousState.history.slice(-4) : [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: "Ты дружелюбный голосовой помощник для ребенка. Отвечай по-русски, очень коротко (1-2 предложения), простым и понятным языком. Не используй markdown, списки или эмодзи.",
    });

    const formattedHistory = history
      .filter((msg) => msg && msg.text)
      .map((msg) => ({
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: String(msg.text) }],
      }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text().trim() || "Я не смог придумать ответ.";

    const nextState = {
      history: [
        ...history,
        { role: "user", text: userMessage },
        { role: "model", text: responseText },
      ],
    };

    return new Response(
      JSON.stringify({
        response: { text: responseText, end_session: false },
        session_state: nextState,
        version: "1.0",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Ошибка сервера:", error);
    return new Response(
      JSON.stringify({
        response: { text: "Произошла ошибка на стороне сервера. Попробуйте еще раз.", end_session: false },
        session_state: {},
        version: "1.0",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
