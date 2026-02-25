import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => console.log('‚úÖ MongoDB Connected'))
  .catch(err => console.error('‚ùå MongoDB Error:', err));

// Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'POKEDOT Backend is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'POKEDOT API is working!',
    version: '1.0.0'
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  Ì∫Ä POKEDOT Backend Server Started
  Ì≥ç Port: ${PORT}
  Ìºê URL: http://localhost:${PORT}
  Ì∑ÑÔ∏è  MongoDB: Connected
  ‚è∞ Time: ${new Date().toLocaleString()}
  `);
  console.log('\nÌ≥ö Available Endpoints:');
  console.log('   GET  /api/health          - Health check');
  console.log('   GET  /api/test            - Test endpoint');
  console.log('   POST /api/auth/register   - Register user');
  console.log('   POST /api/auth/login      - Login');
  console.log('   POST /api/auth/check-coupon - Validate coupon');
  console.log('   GET  /api/auth/profile    - Get profile (protected)');
  console.log('   POST /api/auth/logout     - Logout (protected)');
});
