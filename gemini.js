const { GoogleGenAI } = require("@google/genai")

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY
    this.ai = new GoogleGenAI({
      apiKey: this.apiKey,
    })
  }

  // Test function to verify Gemini is working
  async testGemini() {
    try {
      console.log("🧪 Testing Gemini API with simple question...")

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: "What is the color of the sky?",
      })

      console.log("✅ Gemini Test Response:", response.text)
      return response.text
    } catch (error) {
      console.log("❌ Gemini Test Failed:", error.message)
      return null
    }
  }

  async findMatches(videoData, campaignData) {
    try {
      console.log("🤖 Calling Gemini API for match analysis...")
      console.log("📹 Video Data:", {
        title: videoData.title,
        genre: videoData.genre,
        tone: videoData.tone,
      })
      console.log("📢 Campaign Data:", {
        productName: campaignData.productName,
        category: campaignData.category,
      })

      const prompt = `
        Rate the compatibility (0-100) between this video and this campaign:
        
        VIDEO:
        - Title: ${videoData.title}
        - Genre: ${videoData.genre}
        - Tone: ${videoData.tone}
        
        CAMPAIGN:
        - Product: ${campaignData.productName}
        - Category: ${campaignData.category}
        - Description: ${campaignData.description}
        
        Consider factors like:
        - Genre alignment with product category
        - Tone matching with brand image
        - Target audience compatibility
        - Creative synergy potential
        
        Return ONLY a JSON object with this exact format:
        {
          "score": number,
          "reasoning": "detailed explanation of the match score"
        }
      `

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      })

      console.log("🔍 Raw Gemini Response:", response.text)

      // Extract JSON from the response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.log("⚠️ No valid JSON found in response, using fallback")
        throw new Error("No valid JSON found in Gemini response")
      }

      const result = JSON.parse(jsonMatch[0])
      console.log("✅ Parsed Match Result:", result)

      return result
    } catch (error) {
      console.log("❌ Gemini API error:", error.message)

      // Fallback to simple scoring algorithm
      const fallbackScore = this.calculateFallbackScore(videoData, campaignData)
      console.log("🔄 Using fallback score:", fallbackScore)

      return {
        score: fallbackScore,
        reasoning: `Automated match based on genre and category compatibility. Score: ${fallbackScore}/100`,
      }
    }
  }

  // ==================== CHAT AI FUNCTIONALITY ====================

  async processChatQuery(userMessage, campaignData, videoData) {
    try {
      console.log("🤖 Processing chat query with Gemini...")
      console.log("💬 User Message:", userMessage)
      console.log("📊 Available Campaigns:", campaignData.length)
      console.log("🎥 Available Videos:", videoData.length)

      const prompt = `
        You are an AI assistant for AdVenture, an advertising platform that matches video creators with marketing campaigns.
        
        User Query: "${userMessage}"
        
        Available Campaigns:
        ${campaignData
          .map((c) => `- ${c.productName} (${c.category}): ${c.description}`)
          .join("\n")}
        
        Available Videos:
        ${videoData
          .map(
            (v) => `- "${v.title}" (${v.genre}, ${v.tone}) by ${v.creatorName}`
          )
          .join("\n")}
        
        Please provide a helpful response about campaigns, videos, or matching strategies. Keep it conversational and informative.
        If the user is asking about specific campaigns or videos, reference the data provided.
        
        Respond in a friendly, professional tone as an AI marketing assistant.
      `

      console.log("📝 Sending prompt to Gemini...")

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      })

      console.log("🔍 Raw Chat Response:", response.text)
      console.log("✅ Chat AI response generated successfully")

      return response.text
    } catch (error) {
      console.log("❌ Chat AI error:", error.message)
      console.log("📋 Error details:", error)
      return "I'm sorry, I'm having trouble processing your request right now. Please try again later."
    }
  }

  calculateFallbackScore(videoData, campaignData) {
    console.log("🔄 Calculating fallback score...")

    let score = 50 // Base score

    // Genre-Category matching
    const genreBonus = {
      comedy: { entertainment: 20, food: 15, lifestyle: 10 },
      educational: { technology: 20, healthcare: 15, finance: 10 },
      lifestyle: { fashion: 20, beauty: 15, travel: 10 },
      entertainment: { gaming: 20, music: 15, sports: 10 },
    }

    const bonus =
      genreBonus[videoData.genre.toLowerCase()]?.[
        campaignData.category.toLowerCase()
      ] || 0
    score += bonus

    // Tone matching
    if (
      videoData.tone.toLowerCase().includes("professional") &&
      campaignData.category.toLowerCase().includes("business")
    ) {
      score += 10
    }

    const finalScore = Math.min(Math.max(score, 0), 100)
    console.log("📊 Fallback score calculated:", finalScore)

    return finalScore
  }
}

module.exports = new GeminiService()
