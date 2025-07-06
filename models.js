const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["creator", "marketer"], required: true },
  },
  { timestamps: true }
)

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    genre: { type: String, required: true },
    tone: { type: String, required: true },
    videoPath: { type: String, required: true },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "matched", "approved"],
      default: "uploaded",
    },
  },
  { timestamps: true }
)

const campaignSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String },
    assetPath: { type: String, required: true },
    marketerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
)

const matchSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    matchScore: { type: Number, required: true },
    reasoning: { type: String },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
)

// Create indexes for better performance
userSchema.index({ email: 1 })
videoSchema.index({ creatorId: 1 })
campaignSchema.index({ marketerId: 1 })
matchSchema.index({ videoId: 1, campaignId: 1 })

// ==================== NEW CHAT SYSTEM SCHEMAS ====================

const chatSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    marketerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    content: { type: String, required: true },
    sender: { type: String, enum: ["user", "ai"], required: true },
    metadata: { type: Object, default: {} }, // For storing additional data like query results
  },
  { timestamps: true }
)

// Create indexes for chat system
chatSchema.index({ marketerId: 1 })
messageSchema.index({ chatId: 1 })

const User = mongoose.model("User", userSchema)
const Video = mongoose.model("Video", videoSchema)
const Campaign = mongoose.model("Campaign", campaignSchema)
const Match = mongoose.model("Match", matchSchema)
const Chat = mongoose.model("Chat", chatSchema)
const Message = mongoose.model("Message", messageSchema)

module.exports = { User, Video, Campaign, Match, Chat, Message }
