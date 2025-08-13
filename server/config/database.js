import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kbgao2007:<db_password>@cluster0.69u3tal.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error during MongoDB connection closure:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;
