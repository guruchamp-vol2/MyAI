# 🚀 MyAI Deployment Guide

## Quick Deploy to Render

### Step 1: Prepare Your Repository
1. Make sure all files are committed to your GitHub repository
2. Ensure you have a `render.yaml` file (already created)
3. Verify your `package.json` has the correct scripts

### Step 2: Deploy to Render

#### Option A: Using render.yaml (Easiest)
1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file
5. Click "Apply" to deploy both services

#### Option B: Manual Setup
1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `myai-app`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`

### Step 3: Set Environment Variables
In your Render dashboard, add these environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `TOGETHER_API_KEY` | `your-api-key-here` | Your Together AI API key |
| `JWT_SECRET` | `auto-generate` | Will be auto-generated |
| `NODE_ENV` | `production` | Environment |
| `PORT` | `10000` | Port number |

### Step 4: Get Your API Key
1. Go to [together.ai](https://together.ai)
2. Sign up and get your API key
3. Add it to the `TOGETHER_API_KEY` environment variable in Render

## 📱 Mobile App Deployment

### PWA (Progressive Web App) - Already Working!
Your app is already a PWA! Users can:
1. Open the app on their phone
2. Add to home screen
3. Use it like a native app

### Native Mobile Apps
To create native mobile apps:

#### React Native
```bash
# Create React Native app
npx react-native init MyAIMobile
# Use your API endpoints from the deployed server
```

#### Flutter
```dart
// Create Flutter app
flutter create myai_mobile
// Use HTTP requests to your deployed API
```

#### iOS/Android Native
- Use your deployed API endpoints
- Create native UI components
- Handle authentication with JWT tokens

## 🔄 Updating Your App

### Automatic Updates
1. Make changes to your code
2. Commit and push to GitHub
3. Render automatically redeploys

### Manual Updates
1. Go to your Render dashboard
2. Click "Manual Deploy"
3. Select the branch to deploy

## 🌐 Your App URLs

After deployment, you'll get:
- **Web App**: `https://your-app-name.onrender.com`
- **API Endpoints**: `https://your-app-name.onrender.com/api/*`

## 🐛 Troubleshooting

### Trending Searches Not Working
- Check browser console (F12)
- Verify the `/popular-searches` endpoint
- Sample data is already included

### Search Not Working
- Check your Together AI API key
- Verify environment variables in Render
- Check server logs in Render dashboard

### Deployment Issues
- Ensure all dependencies are in `package.json`
- Check build logs in Render
- Verify Node.js version compatibility

## 📊 Monitoring

### Render Dashboard
- View logs in real-time
- Monitor performance
- Check error rates

### Analytics
- Search analytics are tracked automatically
- View trending searches
- Monitor user engagement

## 🔧 Customization

### Adding Features
1. Modify `server.js` for backend changes
2. Update `public/script.js` for frontend
3. Push to GitHub for auto-deploy

### Styling
- Edit `public/style.css`
- Update `public/index.html`
- Changes deploy automatically

## 🚀 Performance Tips

1. **Caching**: Service worker caches static files
2. **Optimization**: Images and files are optimized
3. **CDN**: Render provides global CDN
4. **Auto-scaling**: Render handles traffic spikes

## 📞 Support

If you need help:
1. Check Render documentation
2. Review server logs
3. Test locally first
4. Check browser console for errors

---

**🎉 Your MyAI app is now ready for deployment!**

The trending searches should now work with the sample data I added. Once you deploy and start using the search feature, real analytics will be collected and displayed. 