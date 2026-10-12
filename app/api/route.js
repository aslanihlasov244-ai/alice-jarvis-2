import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request) {
  try {
    const body = await request.json();
    const userMessage = body.request?.command?.trim() || body.request?.original_utterance?.trim();

    if (!userMessage) {
      return NextResponse.json({
        response: { text: "Скажите, чем я могу помочь.", end_session: false },
        session_state: body.state?.session || {},
        version: "1.0",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Критическая ошибка: Переменная GEMINI_API_KEY не найдена!");
      return NextResponse.json({
        response: { text: "Сервис временно недоступен.", end_session: false },
        session_state: body.state?.session || {},
        version: "1.0",
      });
    }

    const previousState = body.state?.session || {};
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

    return NextResponse.json({
      response: { text: responseText, end_session: false },
      session_state: nextState,
      version: "1.0",
    });
  } catch (error) {
    console.error("Ошибка на сервере:", error);
    return NextResponse.json({
      response: { text: "Произошла ошибка. Пожалуйста, повторите запрос.", end_session: false },
      session_state: body?.state?.session || {},
      version: "1.0",
    });
  }
}
