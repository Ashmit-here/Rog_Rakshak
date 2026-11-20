const express = require('express')
const {
  getMine,
  getPending,
  getReviewHistory,
  reviewReport,
  submitReport,
} = require('../controllers/reportController')
const authenticate = require('../middleware/authenticate')
const authorizeRoles = require('../middleware/authorizeRoles')

const router = express.Router()

router.post('/', authenticate, authorizeRoles('HOSPITAL'), submitReport)
router.get('/mine', authenticate, authorizeRoles('HOSPITAL'), getMine)
router.get('/pending', authenticate, authorizeRoles('MEDICAL_OFFICER'), getPending)
router.get('/history', authenticate, authorizeRoles('MEDICAL_OFFICER'), getReviewHistory)
router.patch('/:id/review', authenticate, authorizeRoles('MEDICAL_OFFICER'), reviewReport)

module.exports = router