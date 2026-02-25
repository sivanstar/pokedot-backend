const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// FIXED CORS Configuration - Allow multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174', 
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:3000',
  'http://localhost:5170'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Test endpoint
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CORS is working!',
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins
  });
});

app.listen(PORT, () => {
  console.log(`Ì∫Ä CORS Test Server running on port ${PORT}`);
  console.log(`Ìºê Allowed origins: ${allowedOrigins.join(', ')}`);
});
