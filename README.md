# AdVenture Backend

AI-powered advertising platform that connects content creators with marketers through intelligent video-campaign matching.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (running locally on port 27017)
- Google Gemini API key

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd adventure-backend
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/adventure
   JWT_SECRET=your-secret-key-here
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

3. **Create upload directories**
   ```bash
   mkdir -p uploads/videos uploads/assets
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

Server will run on `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── server.js          # Main server file with all routes
├── models.js          # MongoDB schemas
├── middleware.js      # Authentication & file upload middleware
├── gemini.js          # AI matching service
├── package.json       # Dependencies
├── .env              # Environment variables
└── uploads/          # File storage
    ├── videos/       # Video files
    └── assets/       # Campaign assets
```

## 🔧 Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "axios": "^1.4.0"
  }
}
```

## 📊 Data Models

### User
```javascript
{
  id: String,
  name: String,
  email: String,
  role: "creator" | "marketer"
}
```

### Video
```javascript
{
  id: String,
  title: String,
  genre: String,
  tone: String,
  videoPath: String,
  creatorId: String,
  creatorName: String,
  status: "uploaded" | "matched" | "approved",
  createdAt: Date
}
```

### Campaign
```javascript
{
  id: String,
  productName: String,
  category: String,
  description: String,
  assetPath: String,
  marketerId: String,
  marketerName: String,
  createdAt: Date
}
```

### Match
```javascript
{
  id: String,
  videoId: String,
  campaignId: String,
  matchScore: Number,
  reasoning: String,
  status: "pending" | "accepted" | "rejected",
  video: Video Object,
  campaign: Campaign Object,
  createdAt: Date
}
```

## 🔐 Authentication

All protected routes require JWT token in headers:
```javascript
Headers: {
  "Authorization": "Bearer <your-jwt-token>"
}
```

## 📋 API Endpoints

### Authentication Routes

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "creator"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Creator Routes

#### Upload Video
```http
POST /api/videos/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData:
- title: "My Awesome Video"
- genre: "Comedy"
- tone: "Humorous"
- video: <video-file>
```

#### Get My Videos
```http
GET /api/videos/my-videos
Authorization: Bearer <token>
```

#### Get My Matches
```http
GET /api/matches/my-matches
Authorization: Bearer <token>
```

#### Accept/Reject Match
```http
PUT /api/matches/{matchId}/accept
Authorization: Bearer <token>

PUT /api/matches/{matchId}/reject
Authorization: Bearer <token>
```

#### Creator Analytics
```http
GET /api/analytics/creator
Authorization: Bearer <token>
```

### Marketer Routes

#### Create Campaign
```http
POST /api/campaigns/create
Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData:
- productName: "Cool Product"
- category: "Tech"
- description: "Amazing product description"
- asset: <asset-file>
```

#### Get My Campaigns
```http
GET /api/campaigns/my-campaigns
Authorization: Bearer <token>
```

#### Get Campaign Matches
```http
GET /api/matches/campaign/{campaignId}
Authorization: Bearer <token>
```

#### Marketer Analytics
```http
GET /api/analytics/marketer
Authorization: Bearer <token>
```

### AI Matching Routes

#### Find Matches
```http
POST /api/ai/find-matches
Authorization: Bearer <token>
Content-Type: application/json

# For video matching:
{ "videoId": "video-id-here" }

# For campaign matching:
{ "campaignId": "campaign-id-here" }
```

## 🎯 Response Format

All API responses follow this structure:
```javascript
{
  "success": boolean,
  "data": object,
  "message": string
}
```

**Success Response:**
```javascript
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

**Error Response:**
```javascript
{
  "success": false,
  "data": null,
  "message": "Error description"
}
```

## 🤖 AI Matching

The platform uses Google Gemini API for intelligent video-campaign matching:

- **Input:** Video metadata (title, genre, tone) + Campaign details (product, category, description)
- **Output:** Match score (0-100) + reasoning explanation
- **Threshold:** Matches above 70% score are considered viable

## 📁 File Handling

### Upload Limits
- **Videos:** 50MB maximum
- **Assets:** 5MB maximum

### File Access
Uploaded files are served statically:
- Videos: `http://localhost:5000/uploads/videos/filename.mp4`
- Assets: `http://localhost:5000/uploads/assets/filename.jpg`

## 🔧 Development

### Running in Development
```bash
npm run dev
```
Uses nodemon for automatic restarts on file changes.

### Database Setup
Ensure MongoDB is running locally on port 27017. The application will automatically create the `adventure` database and required collections.

### Logging
The server logs all API calls with this format:
```
[GET] /api/videos/my-videos - User: John Doe (creator)
✅ Videos fetched successfully
```

## 🚦 Status Codes

- **200:** Success
- **201:** Created
- **400:** Bad Request
- **401:** Unauthorized
- **403:** Forbidden
- **404:** Not Found
- **500:** Internal Server Error

## 🛠️ Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running: `mongod`
   - Check connection string in `.env`

2. **JWT Token Invalid**
   - Verify `JWT_SECRET` in `.env`
   - Check token format in Authorization header

3. **File Upload Fails**
   - Verify upload directories exist
   - Check file size limits

4. **Gemini API Errors**
   - Validate `GEMINI_API_KEY` in `.env`
   - Check API quota limits

### Debug Mode
Enable detailed logging by setting:
```env
NODE_ENV=development
```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 5000) |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |

## 🔒 Security Features

- Password hashing with bcryptjs
- JWT token authentication
- CORS enabled for cross-origin requests
- Input validation and sanitization
- File upload restrictions

## 📈 Performance

- Efficient MongoDB queries with proper indexing
- File size limits to prevent server overload
- Async/await patterns for non-blocking operations
- Error handling to prevent crashes

## 🚀 Deployment

For production deployment:

1. Set environment variables
2. Use process manager (PM2)
3. Configure reverse proxy (Nginx)
4. Set up MongoDB replica set
5. Enable HTTPS

## 📞 Support

For issues or questions:
1. Check troubleshooting section
2. Review API documentation
3. Verify environment configuration
4. Check server logs for errors
