const express = require('express')
const corsMiddleware = require('./config/cors')
const errorHandler = require('./middleware/errorHandler')
const notFound = require('./middleware/notFound')
const authRoutes = require('./routes/authRoutes')
const healthRoutes = require('./routes/healthRoutes')
const reportRoutes = require('./routes/reportRoutes')
const publicRoutes = require('./routes/publicRoutes')

const app = express()

app.use(corsMiddleware)
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Rog_Rakshak API is running' })
})
app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/public', publicRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
