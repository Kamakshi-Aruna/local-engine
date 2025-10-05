import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({
        error: "GEMINI_API_KEY not found"
      }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Try different model names to see which one works
    const modelsToTest = [
      'gemini-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro',
      'text-bison-001',
      'models/gemini-pro',
      'models/gemini-1.5-flash'
    ];

    const results = [];

    for (const modelName of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        results.push({
          model: modelName,
          status: "success",
          response: result.response.text()
        });
        break; // If one works, we're good
      } catch (error: any) {
        results.push({
          model: modelName,
          status: "error",
          error: error.message.substring(0, 100)
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      apiKeyPrefix: geminiApiKey.substring(0, 8) + "..."
    });

  } catch (error: any) {
    return NextResponse.json({
      error: "Test failed",
      details: error.message
    }, { status: 500 });
  }
}