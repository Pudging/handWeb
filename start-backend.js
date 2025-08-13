#!/usr/bin/env node

/**
 * Quick Start Script for MongoDB Backend
 * 
 * This script helps you start the backend server with proper configuration.
 * Make sure you have created a .env file with your MongoDB connection string first!
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

console.log('🚀 Starting Yu-Gi-Oh! Deck Analyzer Backend...\n');

// Check if .env file exists
const envPath = join(process.cwd(), '.env');
if (!existsSync(envPath)) {
  console.log('❌ No .env file found!');
  console.log('📝 Please create a .env file with your MongoDB connection string.');
  console.log('📖 See setup.md for detailed instructions.\n');
  
  console.log('🔧 Quick .env file creation:');
  console.log('Create a file named ".env" in your project root with:');
  console.log('');
  console.log('MONGODB_URI=mongodb+srv://kbgao2007:YOUR_PASSWORD@cluster0.69u3tal.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
  console.log('JWT_SECRET=your_secret_key_here');
  console.log('PORT=5000');
  console.log('NODE_ENV=development');
  console.log('');
  
  process.exit(1);
}

console.log('✅ .env file found');
console.log('📦 Installing dependencies...\n');

// Install dependencies
const install = spawn('npm', ['install'], { stdio: 'inherit' });

install.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Dependencies installed successfully!');
    console.log('🚀 Starting the server...\n');
    
    // Start the server
    const server = spawn('npm', ['run', 'server:dev'], { stdio: 'inherit' });
    
    server.on('close', (code) => {
      console.log(`\n⚠️ Server stopped with code ${code}`);
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      server.kill('SIGINT');
      process.exit(0);
    });
    
  } else {
    console.log('\n❌ Failed to install dependencies');
    process.exit(code);
  }
});

install.on('error', (err) => {
  console.error('\n❌ Error installing dependencies:', err);
  process.exit(1);
});
