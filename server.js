require("dotenv").config()
const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const path = require("path")

const { User, Video, Campaign, Match, Chat, Message } = require("./models")
const {
  authenticateToken,
  requireRole,
  uploadVideo,
  uploadAsset,
} = require("./middleware")
const geminiService = require("./gemini")

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Authenticated static file serving
app.use(
  "/assets",
  // authenticateToken,
  express.static(path.join(__dirname, "uploads", "assets"))
)
app.use(
  "/videos",
  // authenticateToken,
  express.static(path.join(__dirname, "uploads", "videos"))
)

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.log("❌ MongoDB connection error:", err))

// Utility functions
const logRequest = (req, res, next) => {
  const userInfo = req.user
    ? `${req.user.name} (${req.user.role})`
    : "Anonymous"
  console.log(`[${req.method}] ${req.path} - User: ${userInfo}`)
  next()
}

const formatUserData = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
})

const formatVideoData = (video) => ({
  id: video._id,
  title: video.title,
  genre: video.genre,
  tone: video.tone,
  videoPath: video.videoPath,
  creatorId: video.creatorId,
  creatorName: video.creatorId?.name || "Unknown",
  status: video.status,
  createdAt: video.createdAt,
})

const formatCampaignData = (campaign) => ({
  id: campaign._id,
  productName: campaign.productName,
  category: campaign.category,
  description: campaign.description,
  assetPath: campaign.assetPath,
  marketerId: campaign.marketerId,
  marketerName: campaign.marketerId?.name || "Unknown",
  createdAt: campaign.createdAt,
})

const formatMatchData = (match) => ({
  id: match._id,
  videoId: match.videoId,
  campaignId: match.campaignId,
  matchScore: match.matchScore,
  reasoning: match.reasoning,
  status: match.status,
  video: match.videoId ? formatVideoData(match.videoId) : null,
  campaign: match.campaignId ? formatCampaignData(match.campaignId) : null,
  createdAt: match.createdAt,
})

app.use(logRequest)

// ==================== AUTHENTICATION ROUTES ====================

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      })
    }

    if (!["creator", "marketer"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be either creator or marketer",
      })
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
    })

    await user.save()
    console.log("✅ User registration successful")

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    })

    res.status(201).json({
      success: true,
      data: {
        user: formatUserData(user),
        token,
      },
      message: "User registered successfully",
    })
  } catch (error) {
    console.log("❌ Registration failed:", error.message)
    res.status(500).json({
      success: false,
      message: "Registration failed",
    })
  }
})

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    console.log("✅ User login successful")

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    })

    res.json({
      success: true,
      data: {
        user: formatUserData(user),
        token,
      },
      message: "Login successful",
    })
  } catch (error) {
    console.log("❌ Login failed:", error.message)
    res.status(500).json({
      success: false,
      message: "Login failed",
    })
  }
})

// Get current user
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    console.log("✅ User profile retrieved")
    res.json({
      success: true,
      data: {
        user: formatUserData(req.user),
      },
      message: "User profile retrieved successfully",
    })
  } catch (error) {
    console.log("❌ Profile retrieval failed:", error.message)
    res.status(500).json({
      success: false,
      message: "Profile retrieval failed",
    })
  }
})

// ==================== VIDEO ROUTES (CREATOR) ====================

// Upload video
app.post(
  "/api/videos/upload",
  authenticateToken,
  requireRole("creator"),
  (req, res) => {
    uploadVideo(req, res, async (err) => {
      if (err) {
        console.log("❌ Video upload failed:", err.message)
        return res.status(400).json({
          success: false,
          message: err.message,
        })
      }

      try {
        const { title, genre, tone } = req.body

        if (!title || !genre || !tone || !req.file) {
          return res.status(400).json({
            success: false,
            message: "Title, genre, tone, and video file are required",
          })
        }

        const video = new Video({
          title,
          genre,
          tone,
          videoPath: req.file.path.replace(/\\/g, "/"),
          creatorId: req.user._id,
        })

        await video.save()
        console.log("✅ Video upload successful")

        res.status(201).json({
          success: true,
          data: {
            video: formatVideoData(video),
          },
          message: "Video uploaded successfully",
        })
      } catch (error) {
        console.log("❌ Video upload failed:", error.message)
        res.status(500).json({
          success: false,
          message: "Video upload failed",
        })
      }
    })
  }
)

// Get creator's videos
app.get(
  "/api/videos/my-videos",
  authenticateToken,
  requireRole("creator"),
  async (req, res) => {
    try {
      const videos = await Video.find({ creatorId: req.user._id })
        .populate("creatorId", "name")
        .sort({ createdAt: -1 })

      console.log("✅ Creator videos retrieved")

      res.json({
        success: true,
        data: {
          videos: videos.map(formatVideoData),
        },
        message: "Videos retrieved successfully",
      })
    } catch (error) {
      console.log("❌ Videos retrieval failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Videos retrieval failed",
      })
    }
  }
)

// ==================== CAMPAIGN ROUTES (MARKETER) ====================

// Create campaign
app.post(
  "/api/campaigns/create",
  authenticateToken,
  requireRole("marketer"),
  (req, res) => {
    uploadAsset(req, res, async (err) => {
      if (err) {
        console.log("❌ Campaign creation failed:", err.message)
        return res.status(400).json({
          success: false,
          message: err.message,
        })
      }

      try {
        const { productName, category, description } = req.body

        if (!productName || !category || !req.file) {
          return res.status(400).json({
            success: false,
            message: "Product name, category, and asset file are required",
          })
        }

        const campaign = new Campaign({
          productName,
          category,
          description,
          assetPath: req.file.path.replace(/\\/g, "/"),
          marketerId: req.user._id,
        })

        await campaign.save()
        console.log("✅ Campaign creation successful")

        res.status(201).json({
          success: true,
          data: {
            campaign: formatCampaignData(campaign),
          },
          message: "Campaign created successfully",
        })
      } catch (error) {
        console.log("❌ Campaign creation failed:", error.message)
        res.status(500).json({
          success: false,
          message: "Campaign creation failed",
        })
      }
    })
  }
)

// Get marketer's campaigns
app.get(
  "/api/campaigns/my-campaigns",
  authenticateToken,
  requireRole("marketer"),
  async (req, res) => {
    try {
      const campaigns = await Campaign.find({ marketerId: req.user._id })
        .populate("marketerId", "name")
        .sort({ createdAt: -1 })

      console.log("✅ Marketer campaigns retrieved")

      res.json({
        success: true,
        data: {
          campaigns: campaigns.map(formatCampaignData),
        },
        message: "Campaigns retrieved successfully",
      })
    } catch (error) {
      console.log("❌ Campaigns retrieval failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Campaigns retrieval failed",
      })
    }
  }
)

// ==================== MATCH ROUTES ====================

// Get creator's matches
app.get(
  "/api/matches/my-matches",
  authenticateToken,
  requireRole("creator"),
  async (req, res) => {
    try {
      const userVideos = await Video.find({ creatorId: req.user._id }).select(
        "_id"
      )
      const videoIds = userVideos.map((v) => v._id)

      const matches = await Match.find({ videoId: { $in: videoIds } })
        .populate({
          path: "videoId",
          populate: { path: "creatorId", select: "name" },
        })
        .populate({
          path: "campaignId",
          populate: { path: "marketerId", select: "name" },
        })
        .sort({ createdAt: -1 })

      console.log("✅ Creator matches retrieved")

      res.json({
        success: true,
        data: {
          matches: matches.map(formatMatchData),
        },
        message: "Matches retrieved successfully",
      })
    } catch (error) {
      console.log("❌ Matches retrieval failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Matches retrieval failed",
      })
    }
  }
)

// Get campaign matches
app.get(
  "/api/matches/campaign/:campaignId",
  authenticateToken,
  requireRole("marketer"),
  async (req, res) => {
    try {
      const { campaignId } = req.params

      // Verify campaign belongs to the marketer
      const campaign = await Campaign.findOne({
        _id: campaignId,
        marketerId: req.user._id,
      })
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: "Campaign not found",
        })
      }

      const matches = await Match.find({ campaignId })
        .populate({
          path: "videoId",
          populate: { path: "creatorId", select: "name" },
        })
        .populate({
          path: "campaignId",
          populate: { path: "marketerId", select: "name" },
        })
        .sort({ createdAt: -1 })

      console.log("✅ Campaign matches retrieved")

      res.json({
        success: true,
        data: {
          matches: matches.map(formatMatchData),
        },
        message: "Campaign matches retrieved successfully",
      })
    } catch (error) {
      console.log("❌ Campaign matches retrieval failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Campaign matches retrieval failed",
      })
    }
  }
)

// Accept match
app.put(
  "/api/matches/:matchId/accept",
  authenticateToken,
  requireRole("creator"),
  async (req, res) => {
    try {
      const { matchId } = req.params

      const match = await Match.findById(matchId).populate("videoId")
      if (!match) {
        return res.status(404).json({
          success: false,
          message: "Match not found",
        })
      }

      // Verify the match belongs to the creator's video
      if (match.videoId.creatorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        })
      }

      match.status = "accepted"
      await match.save()

      // Update video status
      await Video.findByIdAndUpdate(match.videoId._id, { status: "approved" })

      console.log("✅ Match accepted")

      res.json({
        success: true,
        data: {
          match: formatMatchData(match),
        },
        message: "Match accepted successfully",
      })
    } catch (error) {
      console.log("❌ Match acceptance failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Match acceptance failed",
      })
    }
  }
)

// Reject match
app.put(
  "/api/matches/:matchId/reject",
  authenticateToken,
  requireRole("creator"),
  async (req, res) => {
    try {
      const { matchId } = req.params

      const match = await Match.findById(matchId).populate("videoId")
      if (!match) {
        return res.status(404).json({
          success: false,
          message: "Match not found",
        })
      }

      // Verify the match belongs to the creator's video
      if (match.videoId.creatorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        })
      }

      match.status = "rejected"
      await match.save()

      console.log("✅ Match rejected")

      res.json({
        success: true,
        data: {
          match: formatMatchData(match),
        },
        message: "Match rejected successfully",
      })
    } catch (error) {
      console.log("❌ Match rejection failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Match rejection failed",
      })
    }
  }
)

// ==================== AI MATCHING ROUTES ====================

// Find matches
app.post("/api/ai/find-matches", authenticateToken, async (req, res) => {
  try {
    const { videoId, campaignId } = req.body

    if (!videoId && !campaignId) {
      return res.status(400).json({
        success: false,
        message: "Either videoId or campaignId is required",
      })
    }

    let matches = []

    if (videoId) {
      // Find matches for a specific video
      const video = await Video.findById(videoId).populate("creatorId", "name")
      if (!video) {
        return res.status(404).json({
          success: false,
          message: "Video not found",
        })
      }

      // Verify video belongs to the creator
      if (
        req.user.role === "creator" &&
        video.creatorId._id.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        })
      }

      const campaigns = await Campaign.find().populate("marketerId", "name")

      for (const campaign of campaigns) {
        // Check if match already exists
        const existingMatch = await Match.findOne({
          videoId,
          campaignId: campaign._id,
        })
        if (existingMatch) {
          matches.push(
            await Match.findById(existingMatch._id)
              .populate({
                path: "videoId",
                populate: { path: "creatorId", select: "name" },
              })
              .populate({
                path: "campaignId",
                populate: { path: "marketerId", select: "name" },
              })
          )
          continue
        }

        // Generate new match using AI
        const aiResult = await geminiService.findMatches(video, campaign)

        const newMatch = new Match({
          videoId,
          campaignId: campaign._id,
          matchScore: aiResult.score,
          reasoning: aiResult.reasoning,
        })

        await newMatch.save()

        // Update video status
        await Video.findByIdAndUpdate(videoId, { status: "matched" })

        const populatedMatch = await Match.findById(newMatch._id)
          .populate({
            path: "videoId",
            populate: { path: "creatorId", select: "name" },
          })
          .populate({
            path: "campaignId",
            populate: { path: "marketerId", select: "name" },
          })

        matches.push(populatedMatch)
      }
    }

    if (campaignId) {
      // Find matches for a specific campaign
      const campaign = await Campaign.findById(campaignId).populate(
        "marketerId",
        "name"
      )
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: "Campaign not found",
        })
      }

      // Verify campaign belongs to the marketer
      if (
        req.user.role === "marketer" &&
        campaign.marketerId._id.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized",
        })
      }

      const videos = await Video.find().populate("creatorId", "name")

      for (const video of videos) {
        // Check if match already exists
        const existingMatch = await Match.findOne({
          videoId: video._id,
          campaignId,
        })
        if (existingMatch) {
          matches.push(
            await Match.findById(existingMatch._id)
              .populate({
                path: "videoId",
                populate: { path: "creatorId", select: "name" },
              })
              .populate({
                path: "campaignId",
                populate: { path: "marketerId", select: "name" },
              })
          )
          continue
        }

        // Generate new match using AI
        const aiResult = await geminiService.findMatches(video, campaign)

        const newMatch = new Match({
          videoId: video._id,
          campaignId,
          matchScore: aiResult.score,
          reasoning: aiResult.reasoning,
        })

        await newMatch.save()

        // Update video status
        await Video.findByIdAndUpdate(video._id, { status: "matched" })

        const populatedMatch = await Match.findById(newMatch._id)
          .populate({
            path: "videoId",
            populate: { path: "creatorId", select: "name" },
          })
          .populate({
            path: "campaignId",
            populate: { path: "marketerId", select: "name" },
          })

        matches.push(populatedMatch)
      }
    }

    // Sort matches by score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore)

    console.log("✅ AI matches generated")

    res.json({
      success: true,
      data: {
        matches: matches.map(formatMatchData),
      },
      message: "Matches generated successfully",
    })
  } catch (error) {
    console.log("❌ AI matching failed:", error.message)
    res.status(500).json({
      success: false,
      message: "AI matching failed",
    })
  }
})

// ==================== ANALYTICS ROUTES ====================

// Creator analytics
app.get(
  "/api/analytics/creator",
  authenticateToken,
  requireRole("creator"),
  async (req, res) => {
    try {
      const totalVideos = await Video.countDocuments({
        creatorId: req.user._id,
      })

      const videoIds = await Video.find({ creatorId: req.user._id }).select(
        "_id"
      )
      const videoIdList = videoIds.map((v) => v._id)

      const pendingMatches = await Match.countDocuments({
        videoId: { $in: videoIdList },
        status: "pending",
      })

      const acceptedMatches = await Match.countDocuments({
        videoId: { $in: videoIdList },
        status: "accepted",
      })

      const rejectedMatches = await Match.countDocuments({
        videoId: { $in: videoIdList },
        status: "rejected",
      })

      console.log("✅ Creator analytics retrieved")

      res.json({
        success: true,
        data: {
          totalVideos,
          pendingMatches,
          acceptedMatches,
          rejectedMatches,
        },
        message: "Creator analytics retrieved successfully",
      })
    } catch (error) {
      console.log("❌ Creator analytics failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Creator analytics failed",
      })
    }
  }
)

// Marketer analytics
app.get(
  "/api/analytics/marketer",
  authenticateToken,
  requireRole("marketer"),
  async (req, res) => {
    try {
      const totalCampaigns = await Campaign.countDocuments({
        marketerId: req.user._id,
      })

      const campaignIds = await Campaign.find({
        marketerId: req.user._id,
      }).select("_id")
      const campaignIdList = campaignIds.map((c) => c._id)

      const totalMatches = await Match.countDocuments({
        campaignId: { $in: campaignIdList },
      })

      const acceptedMatches = await Match.countDocuments({
        campaignId: { $in: campaignIdList },
        status: "accepted",
      })

      const rejectedMatches = await Match.countDocuments({
        campaignId: { $in: campaignIdList },
        status: "rejected",
      })

      console.log("✅ Marketer analytics retrieved")

      res.json({
        success: true,
        data: {
          totalCampaigns,
          totalMatches,
          acceptedMatches,
          rejectedMatches,
        },
        message: "Marketer analytics retrieved successfully",
      })
    } catch (error) {
      console.log("❌ Marketer analytics failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Marketer analytics failed",
      })
    }
  }
)

// ==================== AI CHAT SYSTEM ROUTES ====================

// Format functions for chat system
const formatChatData = (chat) => ({
  id: chat._id,
  title: chat.title,
  marketerId: chat.marketerId,
  isActive: chat.isActive,
  createdAt: chat.createdAt,
})

const formatMessageData = (message) => ({
  id: message._id,
  chatId: message.chatId,
  content: message.content,
  sender: message.sender,
  metadata: message.metadata,
  createdAt: message.createdAt,
})

// Create new chat
app.post(
  "/api/chat/create",
  authenticateToken,
  requireRole("marketer"),
  async (req, res) => {
    try {
      const { title } = req.body

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Chat title is required",
        })
      }

      const chat = new Chat({
        title,
        marketerId: req.user._id,
      })

      await chat.save()
      console.log("✅ Chat created successfully")

      res.status(201).json({
        success: true,
        data: {
          chat: formatChatData(chat),
        },
        message: "Chat created successfully",
      })
    } catch (error) {
      console.log("❌ Chat creation failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Chat creation failed",
      })
    }
  }
)

// Get marketer's chats
app.get(
  "/api/chat/my-chats",
  authenticateToken,
  requireRole("marketer"),
  async (req, res) => {
    try {
      const chats = await Chat.find({ marketerId: req.user._id }).sort({
        createdAt: -1,
      })

      console.log("✅ Chats retrieved successfully")

      res.json({
        success: true,
        data: {
          chats: chats.map(formatChatData),
        },
        message: "Chats retrieved successfully",
      })
    } catch (error) {
      console.log("❌ Chats retrieval failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Chats retrieval failed",
      })
    }
  }
)

// Get chat messages
app.get(
  "/api/chat/:chatId/messages",
  authenticateToken,
  requireRole("marketer"),
  async (req, res) => {
    try {
      const { chatId } = req.params

      // Verify chat belongs to the marketer
      const chat = await Chat.findOne({ _id: chatId, marketerId: req.user._id })
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat not found",
        })
      }

      const messages = await Message.find({ chatId }).sort({ createdAt: 1 })

      console.log("✅ Chat messages retrieved")

      res.json({
        success: true,
        data: {
          messages: messages.map(formatMessageData),
        },
        message: "Messages retrieved successfully",
      })
    } catch (error) {
      console.log("❌ Messages retrieval failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Messages retrieval failed",
      })
    }
  }
)

// Send message to chat
app.post(
  "/api/chat/:chatId/message",
  authenticateToken,
  requireRole("marketer"),
  async (req, res) => {
    try {
      const { chatId } = req.params
      const { content } = req.body

      if (!content) {
        return res.status(400).json({
          success: false,
          message: "Message content is required",
        })
      }

      // Verify chat belongs to the marketer
      const chat = await Chat.findOne({ _id: chatId, marketerId: req.user._id })
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat not found",
        })
      }

      // Save user message
      const userMessage = new Message({
        chatId,
        content,
        sender: "user",
      })
      await userMessage.save()

      // Get data for AI context
      const campaigns = await Campaign.find({
        marketerId: req.user._id,
      }).populate("marketerId", "name")

      const videos = await Video.find().populate("creatorId", "name")

      // Generate AI response
      const aiResponse = await geminiService.processChatQuery(
        content,
        campaigns.map(formatCampaignData),
        videos.map(formatVideoData)
      )

      // Save AI message
      const aiMessage = new Message({
        chatId,
        content: aiResponse,
        sender: "ai",
      })
      await aiMessage.save()

      console.log("✅ Chat messages sent and AI response generated")

      res.json({
        success: true,
        data: {
          userMessage: formatMessageData(userMessage),
          aiMessage: formatMessageData(aiMessage),
        },
        message: "Messages sent successfully",
      })
    } catch (error) {
      console.log("❌ Message sending failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Message sending failed",
      })
    }
  }
)

// Delete chat
app.delete(
  "/api/chat/:chatId",
  authenticateToken,
  requireRole("marketer"),
  async (req, res) => {
    try {
      const { chatId } = req.params

      // Verify chat belongs to the marketer
      const chat = await Chat.findOne({ _id: chatId, marketerId: req.user._id })
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat not found",
        })
      }

      // Delete all messages in the chat
      await Message.deleteMany({ chatId })

      // Delete the chat
      await Chat.findByIdAndDelete(chatId)

      console.log("✅ Chat deleted successfully")

      res.json({
        success: true,
        message: "Chat deleted successfully",
      })
    } catch (error) {
      console.log("❌ Chat deletion failed:", error.message)
      res.status(500).json({
        success: false,
        message: "Chat deletion failed",
      })
    }
  }
)

// ==================== ERROR HANDLING ====================

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  })
})

// Global error handler
app.use((err, req, res, next) => {
  console.log("❌ Global error:", err.message)
  res.status(500).json({
    success: false,
    message: "Internal server error",
  })
})

// ==================== SERVER START ====================

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 AdVenture Backend Server running on port ${PORT}`)
  console.log(`🔒 Authenticated file serving enabled for /assets and /videos`)
  console.log(
    `🔒 JWT Secret: ${process.env.JWT_SECRET ? "Configured" : "Not configured"}`
  )
  console.log(
    `🤖 Gemini API: ${
      process.env.GEMINI_API_KEY ? "Configured" : "Not configured"
    }`
  )
  console.log(`💬 AI Chat System: Enabled for marketers`)
})
