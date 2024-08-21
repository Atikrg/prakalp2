const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

router.post('/addProject', projectController.addProject);
router.post('/deleteProject',projectController.deleteProject);
router.post('/updateProject', projectController.updateProject);
router.get('/getProjectNames', projectController.getProjectNames);
router.post('/empOverviewPrjIndividual', projectController.empOverviewPrjIndividual);
router.get('/EmpOverviewPlusMinus', projectController.EmpOverviewPlusMinus);
router.post('/createCopyProject', projectController.createCopyProject);
router.post('/updateProjectSorting',projectController.updateProjectSorting);
router.get('/projectOverview',projectController.projectOverview);
router.get('/totalHrs',projectController.totalHrs);
router.get('/YTSWIPhrs',projectController.YTSWIPhrs);

module.exports = router;
