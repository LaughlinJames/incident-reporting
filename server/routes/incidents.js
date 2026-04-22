import { Router } from 'express';
import * as incidentsController from '../controllers/incidentsController.js';

const router = Router();

router.get('/', incidentsController.listIncidents);
router.get('/:id', incidentsController.getIncidentById);
router.post('/', incidentsController.createIncident);
router.patch('/:id', incidentsController.updateIncident);
router.post('/:id/timeline', incidentsController.addTimelineEvent);
router.post('/:id/customer-update', incidentsController.addCustomerUpdate);

export default router;
