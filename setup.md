# 🚀 **Complete Setup Guide - Yu-Gi-Oh! Deck Analyzer**

This guide will walk you through setting up the complete application with all features enabled.

## 📋 **Prerequisites**

- **Node.js 18+** installed on your system
- **MongoDB Atlas account** (you already have this!)
- **Git** for cloning the repository
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

## 🔧 **Step 1: Environment Configuration**

Create a `.env` file in your project root with the following content:

```bash
# MongoDB Connection
MONGODB_URI=mongodb+srv://kbgao2007:YOUR_ACTUAL_PASSWORD@cluster0.69u3tal.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# Security
BCRYPT_ROUNDS=12
ACCOUNT_LOCKOUT_THRESHOLD=5
ACCOUNT_LOCKOUT_DURATION=900000
```

**⚠️ Important**: Replace `YOUR_ACTUAL_PASSWORD` with your actual MongoDB Atlas password!

## 📦 **Step 2: Install Dependencies**

Run the following command in your project root:

```bash
npm install
```

This will install all the required packages for both frontend and backend.

## 🚀 **Step 3: Start the Backend Server**

Open a terminal in your project root and run:

```bash
npm run server:dev
```

You should see output like:
```
✅ MongoDB Connected: cluster0.69u3tal.mongodb.net
🚀 Server running on port 5000
```

## 🌐 **Step 4: Start the Frontend**

Open another terminal in your project root and run:

```bash
npm run dev
```

You should see output like:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

## 🎯 **Step 5: Access the Application**

Open your browser and navigate to `http://localhost:3000`

## 🔐 **Step 6: Create Your First Account**

1. **Click the "Create Account" button** in the authentication section
2. **Fill in your details**:
   - Username: Choose a unique username
   - Email: Enter your email address
   - Password: Create a strong password
3. **Click "Create Account"**

You should see a success message and be automatically logged in!

## 🎴 **Step 7: Explore the Features**

### **🤖 AI Chatbot**
- Look for the floating 🤖 button in the bottom-right corner
- Click it to open the AI assistant
- Ask questions like:
  - "Help me build a competitive deck"
  - "What cards work well together?"
  - "Analyze my current deck"

### **📊 Analytics Dashboard**
- Click the "Show Analytics" button in the sidebar
- Explore the different tabs:
  - **Overview**: Key statistics and performance metrics
  - **Composition**: Card type distribution and attributes
  - **Performance**: Detailed performance analysis
  - **Simulations**: Hand simulation results over time
  - **Tips**: AI-powered deck improvement suggestions

### **🎴 Deck Manager**
- Click the "Deck Manager" button in the sidebar
- **Save your current deck** with tags and descriptions
- **Browse public decks** from other users
- **Load saved decks** from your collection

### **🎲 Hand Simulation**
- Click the "Hand Simulation" button to access advanced probability calculations
- **Set up target hands** with complex conditions
- **Run simulations** with thousands of iterations
- **Analyze results** with detailed statistics

## 🧪 **Step 8: Test the Features**

### **Test AI Chatbot**
1. Open the AI chatbot
2. Ask: "What makes a good Yu-Gi-Oh! deck?"
3. Try the quick action buttons
4. Test natural language queries

### **Test Analytics**
1. Build a deck with some cards
2. Open the Analytics Dashboard
3. Check different tabs and charts
4. Verify real-time updates

### **Test Deck Management**
1. Save your current deck
2. Try loading it back
3. Check the public decks section
4. Test deck duplication

### **Test Hand Simulation**
1. Go to Hand Simulation
2. Set up a simple target hand
3. Run a simulation
4. Check the results

## 🔍 **Troubleshooting**

### **Backend Won't Start**
- Check if MongoDB connection string is correct
- Verify all environment variables are set
- Check if port 5000 is available
- Look for error messages in the terminal

### **Frontend Won't Start**
- Check if Node.js version is 18+
- Verify all dependencies are installed
- Check if port 3000 is available
- Look for build errors in the terminal

### **AI Chatbot Not Working**
- Check browser console for TensorFlow.js errors
- Verify internet connection (needed for model loading)
- Try refreshing the page
- Check if the model loaded successfully

### **Analytics Not Showing**
- Make sure you have cards in your deck
- Check if Chart.js is loading properly
- Verify the deck state is being passed correctly
- Check browser console for errors

### **Authentication Issues**
- Verify JWT_SECRET is set in .env
- Check if MongoDB is accessible
- Verify the backend is running on port 5000
- Check browser console for API errors

## 📱 **Mobile Testing**

1. **Open your browser's developer tools**
2. **Toggle device toolbar** (mobile view)
3. **Test responsive design** on different screen sizes
4. **Verify touch interactions** work properly

## 🚀 **Production Deployment**

### **Using Docker**
```bash
# Build the production image
docker build -t yugioh-deck-analyzer .

# Run the container
docker run -p 80:80 yugioh-deck-analyzer
```

### **Manual Deployment**
1. **Build the frontend**: `npm run build`
2. **Set NODE_ENV=production** in your environment
3. **Configure your web server** (Nginx, Apache)
4. **Set up SSL certificates** for HTTPS
5. **Configure environment variables** for production

## 📊 **Performance Monitoring**

### **Lighthouse Score**
- Run Lighthouse in Chrome DevTools
- Target: 95+ in all categories
- Focus on Performance, Accessibility, Best Practices, SEO

### **Backend Monitoring**
- Check MongoDB connection status
- Monitor API response times
- Watch for memory leaks
- Monitor error rates

## 🔒 **Security Checklist**

- [ ] JWT_SECRET is strong and unique
- [ ] MongoDB connection uses SSL
- [ ] Rate limiting is configured
- [ ] Input validation is working
- [ ] CORS is properly configured
- [ ] Security headers are set
- [ ] Passwords are hashed with bcrypt

## 🎯 **Next Steps**

1. **Customize the AI model** for better responses
2. **Add more chart types** to the analytics dashboard
3. **Implement real-time collaboration** features
4. **Add tournament integration** capabilities
5. **Create mobile app** using React Native
6. **Set up monitoring** and alerting
7. **Implement CI/CD** pipeline
8. **Add automated testing**

## 📞 **Getting Help**

If you encounter issues:

1. **Check the browser console** for error messages
2. **Review the terminal output** for backend errors
3. **Verify environment variables** are set correctly
4. **Check MongoDB Atlas** connection status
5. **Review the troubleshooting section** above

## 🎉 **Congratulations!**

You now have a fully functional, professional-grade Yu-Gi-Oh! Deck Analyzer with:

- ✅ AI-powered chatbot with TensorFlow.js
- ✅ Advanced analytics dashboard with Chart.js
- ✅ Secure JWT authentication system
- ✅ MongoDB cloud database integration
- ✅ Real-time features with WebSocket
- ✅ Professional UI/UX with Framer Motion
- ✅ Comprehensive deck management
- ✅ Advanced hand simulation engine

This project showcases expertise in:
- **Full-stack development**
- **AI/ML integration**
- **Enterprise security**
- **Real-time applications**
- **Modern web technologies**
- **Performance optimization**

Perfect for your resume and portfolio! 🚀
