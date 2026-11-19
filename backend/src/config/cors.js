const cors = require('cors')

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET'],
}

module.exports = cors(corsOptions)
