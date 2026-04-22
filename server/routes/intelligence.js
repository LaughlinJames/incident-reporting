import { Router } from 'express';
import * as intelligenceController from '../controllers/intelligenceController.js';

const router = Router();

router.post('/recommend', intelligenceController.recommend);

export default router;
