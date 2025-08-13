# 🔒 Setting Up Environment Variables Safely

## **IMPORTANT: Never commit your .env file to GitHub!**

## **Step 1: Create Your .env File**

Create a file called `.env` in your project root with your actual tokens:

```bash
# .env (this file should NEVER be committed to git)
HUGGING_FACE_TOKEN=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
MONGODB_URI=mongodb+srv://kbgao2007:<your_password>@cluster0.69u3tal.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=your_super_secret_random_string_here
PORT=5000
NODE_ENV=development
```

## **Step 2: Verify .gitignore**

Make sure your `.gitignore` contains:
```
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

## **Step 3: Test Your Setup**

1. Create the `.env` file with your real tokens
2. Restart your development server
3. Test the AI chatbot - it should now work with real AI!

## **Step 4: For Production/Deployment**

When deploying, set environment variables in your hosting platform:
- **Vercel**: Environment Variables section
- **Netlify**: Environment Variables section  
- **Heroku**: Config Vars
- **Railway**: Variables section

## **Security Checklist:**
✅ `.env` file created with real tokens  
✅ `.env` file added to `.gitignore`  
✅ `env.example` committed to git (template only)  
✅ No tokens visible in your code  
✅ Ready to push to GitHub safely!  

## **Your Current Tokens:**
- **Hugging Face**: `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`
- **MongoDB**: Your connection string
- **JWT Secret**: Generate a random string

## **Generate JWT Secret:**
```bash
# Run this in terminal to generate a random secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
