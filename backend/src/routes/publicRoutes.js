const express = require('express')
const {
  getPublicStatistics,
  getReferenceData,
} = require('../controllers/reportController')

const router = express.Router()

router.get('/statistics', getPublicStatistics)
router.get('/reference-data', getReferenceData)

module.exports = router
