const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimiter');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Body parser
app.use(express.json());

// Enable CORS with specific configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://parkaccess-urban-reserve.vercel.app',  // Production frontend
        // Add other production URLs here
      ]
    : [
        'http://localhost:3000',  // Local development
        'http://localhost:5173',  // Vite dev server
        'http://localhost:8080',  // Vue CLI dev server
        'http://192.168.15.8:8080'
        // Add your actual development URLs here
      ],
  credentials: true,  // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Define routes
const authRoutes = require('./routes/authRoutes');
const parkingLotRoutes = require('./routes/parkingLotRoutes');
const timeSlotRoutes = require('./routes/timeSlots');
const paymentRoutes = require('./routes/paymentRoutes');
const analyticsRoutes = require('./routes/analytics');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/parking-lots', parkingLotRoutes);
app.use('/api/time-slots', timeSlotRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/', (req, res) => {
  res.send('API is running');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});