const app = require('./app')
const { validateEnvironment } = require('./config/environment')

function startServer() {
  try {
    validateEnvironment()
  } catch (error) {
    console.error(`Invalid server configuration: ${error.message}`)
    process.exitCode = 1
    return null
  }

  const port = process.env.PORT || 5001
  return app.listen(port, () => {
    console.log(`Rog_Rakshak API listening on port ${port}`)
  })
}

if (require.main === module) {
  startServer()
}

module.exports = { app, startServer }