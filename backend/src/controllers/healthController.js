function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'Rog_Rakshak API',
    timestamp: new Date().toISOString(),
  })
}

module.exports = { getHealth }
