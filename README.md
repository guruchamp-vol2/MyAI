# MyAI - Smart AI Chat Assistant

A powerful AI chat assistant with enhanced search capabilities, file analysis, and voice input features.

## 🚀 Features

- **🤖 Smart AI Chat**: Powered by Together AI's Mixtral model
- **🔍 Enhanced Search**: Multi-source search with AI processing
- **📄 File Analysis**: Support for PDFs, images, documents, and more
- **🗣️ Voice Input**: Speech-to-text functionality
- **📊 Search Analytics**: Track popular searches and trends
- **🔐 User Authentication**: Secure login/signup system
- **💾 Chat Memory**: AI remembers conversation context

## 🛠️ Local Development

### Prerequisites
- Node.js 16+ 
- npm 8+
- Together AI API key

### Setup
1. Clone the repository:
```bash
git clone https://github.com/yourusername/MyAI.git
cd MyAI
```

2. Install dependencies:
```bash
npm install
```

3. Create environment variables:
```bash
# Create .env file
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-here
TOGETHER_API_KEY=your-together-api-key-here
```

4. Start the development server:
```bash
npm run dev
```

5. Open http://localhost:3000 in your browser

## 🚀 Deployment on Render

### Option 1: Using render.yaml (Recommended)

1. Push your code to GitHub
2. Connect your GitHub repository to Render
3. Render will automatically detect the `render.yaml` file
4. Set up environment variables in Render dashboard:
   - `TOGETHER_API_KEY`: Your Together AI API key
   - `JWT_SECRET`: Will be auto-generated
   - `NODE_ENV`: production
   - `PORT`: 10000

### Option 2: Manual Setup

1. Create a new **Web Service** on Render
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node
   - **Plan**: Free

4. Add environment variables:
   - `TOGETHER_API_KEY`
   - `JWT_SECRET` (auto-generate)
   - `NODE_ENV=production`
   - `PORT=10000`

### Environment Variables for Render

| Variable | Description | Required |
|----------|-------------|----------|
| `TOGETHER_API_KEY` | Your Together AI API key | Yes |
| `JWT_SECRET` | Secret for JWT tokens | Auto-generated |
| `NODE_ENV` | Environment (production) | Yes |
| `PORT` | Port number (10000) | Yes |

## 📱 Mobile App Deployment

To deploy as a mobile app, you can:

1. **PWA (Progressive Web App)**: The web app already works on mobile browsers
2. **React Native**: Convert the frontend to React Native
3. **Flutter**: Create a Flutter app that consumes the API
4. **Native Apps**: Use the API endpoints in iOS/Android apps

## 🔧 API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User login

### Chat & Search
- `POST /chat` - AI chat messages
- `POST /search` - Smart AI search
- `GET /popular-searches` - Trending searches
- `POST /search-analytics` - Track search analytics

### File Upload
- `POST /upload` - File analysis (PDF, images, documents)

## 🛡️ Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Input validation
- Rate limiting (can be added)

## 📊 Analytics

The app tracks:
- Search queries and success rates
- Popular searches
- User engagement metrics

## 🔄 Auto-Deployment

Render automatically deploys when you push to your main branch. To update:

1. Make changes locally
2. Commit and push to GitHub
3. Render automatically rebuilds and deploys

## 🐛 Troubleshooting

### Trending Searches Not Working
- Check browser console for errors
- Ensure the `/popular-searches` endpoint is accessible
- Verify search analytics are being tracked

### Search Not Working
- Check your Together AI API key
- Verify internet connectivity
- Check server logs for errors

### File Upload Issues
- Ensure file size is under 1MB
- Check supported file types
- Verify file permissions

## 📈 Performance Optimization

- Search results are cached in memory
- File processing is optimized for speed
- AI responses are streamed for better UX

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC License - see LICENSE file for details

## 👨‍💻 Author

**Dhruv Bajaj** - Creator of MyAI

---

**Note**: Make sure to set up your Together AI API key before deploying. The app won't work without it! 