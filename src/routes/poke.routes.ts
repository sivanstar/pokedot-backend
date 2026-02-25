import express from 'express';
import { body } from 'express-validator';
import {
  sendPoke,
  getPokeHistory,
  getAvailableUsers
} from '../controllers/poke.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Send poke to user
router.post('/users/:userId/poke', [
  body('adTaskId')
    .if(() => process.env.AD_REQUIRED === 'true')
    .notEmpty()
    .withMessage('Ad task completion is required')
], sendPoke);

// Get poke history
router.get('/users/me/pokes', getPokeHistory);

// Get users available for poking
router.get('/users/available', getAvailableUsers);

export default router;
