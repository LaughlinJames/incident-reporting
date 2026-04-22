import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';

const router = Router();

router.get('/summary', dashboardController.getSummary);
router.get('/by-severity', dashboardController.getBySeverity);
router.get('/open-by-customer', dashboardController.getOpenByCustomer);

export default router;
