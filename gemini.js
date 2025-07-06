const axios = require("axios")

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY
    this.baseUrl =
      "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent"
  }

  async findMatches(videoData, campaignData) {
    try {
      console.log("🤖 Calling Gemini API for match analysis...")

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

      const response = await axios.post(
        `${this.baseUrl}?key=${this.apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      )

      const generatedText = response.data.candidates[0].content.parts[0].text

      // Extract JSON from the response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("No valid JSON found in Gemini response")
      }

      const result = JSON.parse(jsonMatch[0])

      console.log("✅ Gemini API response received:", result)
      return result
    } catch (error) {
      console.log("❌ Gemini API error:", error.message)

      // Fallback to simple scoring algorithm
      const fallbackScore = this.calculateFallbackScore(videoData, campaignData)
      return {
        score: fallbackScore,
        reasoning: `Automated match based on genre and category compatibility. Score: ${fallbackScore}/100`,
      }
    }
  }

  calculateFallbackScore(videoData, campaignData) {
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

    return Math.min(Math.max(score, 0), 100)
  }
}

module.exports = new GeminiService()
