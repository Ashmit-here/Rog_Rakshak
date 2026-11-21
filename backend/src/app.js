// Import Express and application middleware
const express = require('express')
const corsMiddleware = require('./config/cors')
const errorHandler = require('./middleware/errorHandler')
const notFound = require('./middleware/notFound')

// Import API route modules
const authRoutes = require('./routes/authRoutes')
const healthRoutes = require('./routes/healthRoutes')
const reportRoutes = require('./routes/reportRoutes')
const publicRoutes = require('./routes/publicRoutes')

// Initialize Express application
const app = express()

// Register global middleware
app.use(corsMiddleware)
app.use(express.json())

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Rog_Rakshak API is running' })
})

// Register API routes
app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/public', publicRoutes)

// Handle unknown routes and application errors
app.use(notFound)
app.use(errorHandler)

// Export Express application
module.exports = app