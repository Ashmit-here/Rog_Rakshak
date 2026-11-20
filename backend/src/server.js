const express = require('express')
const corsMiddleware = require('./config/cors')
const errorHandler = require('./middleware/errorHandler')
const notFound = require('./middleware/notFound')
const healthRoutes = require('./routes/healthRoutes')

const app = express()
const port = process.env.PORT || 5001

app.use(corsMiddleware)
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Rog_Rakshak API is running' })
})
app.use('/api/health', healthRoutes)

app.use(notFound)
app.use(errorHandler)

app.listen(port, () => {
  console.log(`Rog_Rakshak API listening on port ${port}`)
})