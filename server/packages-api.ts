import { Router } from 'express';
import multer from 'multer';
import { db } from './db';
import { lexnetPackages, documents, notifications, executionPlans, executionActions } from '../shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { createPackageFromUploadPath, processPackage } from './package-processor';
import { generateExecutionPlan, saveExecutionPlan, getPlanWithActions, approvePlan, cancelPlan, executePlan } from './execution-plan-service';

const router = Router();

const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_RECEIPT_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({ 
  storage: multer.diskStorage({
    destination: '/tmp/uploads',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
    }
  }),
  limits: {
    fileSize: MAX_ZIP_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'zip' && !file.originalname.toLowerCase().endsWith('.zip')) {
      cb(new Error('Only ZIP files are allowed for package upload'));
      return;
    }
    if (file.fieldname === 'receipt' && !file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(new Error('Only PDF files are allowed for receipts'));
      return;
    }
    cb(null, true);
  }
});

router.get('/packages', async (req, res) => {
  try {
    const packages = await db
      .select()
      .from(lexnetPackages)
      .orderBy(desc(lexnetPackages.downloadDate))
      .limit(100);
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching packages' });
  }
});

router.get('/packages/:id', async (req, res) => {
  try {
    const [pkg] = await db
      .select()
      .from(lexnetPackages)
      .where(eq(lexnetPackages.id, parseInt(req.params.id)))
      .limit(1);

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.packageId, pkg.id))
      .orderBy(documents.sequenceNumber);

    res.json({ ...pkg, documents: docs });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching package' });
  }
});

router.post('/packages/upload', upload.fields([
  { name: 'zip', maxCount: 1 },
  { name: 'receipt', maxCount: 1 }
]), async (req: any, res) => {
  try {
    const zipFile = req.files?.['zip']?.[0];
    const receiptFile = req.files?.['receipt']?.[0];
    const lawyerId = req.user?.id || parseInt(req.body.lawyerId);
    const lexnetIds = req.body.lexnetIds ? JSON.parse(req.body.lexnetIds) : [];

    if (!zipFile) {
      return res.status(400).json({ error: 'ZIP file is required' });
    }

    const packageId = await createPackageFromUploadPath(
      lawyerId,
      zipFile.path,
      receiptFile?.path,
      lexnetIds
    );

    res.json({ success: true, packageId });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error uploading package' });
  }
});

router.post('/packages/:id/process', async (req: any, res) => {
  try {
    const packageId = parseInt(req.params.id);
    const userId = req.user?.id || 1;

    console.log(`[Package Process] Starting processing for package ${packageId}, user ${userId}`);
    const result = await processPackage(packageId, userId);
    console.log(`[Package Process] Completed for package ${packageId}:`, JSON.stringify(result, null, 2));
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('[Package Process] Error:', error);
    res.status(500).json({ error: 'Error processing package: ' + error.message });
  }
});

router.get('/packages/:id/documents', async (req, res) => {
  try {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.packageId, parseInt(req.params.id)))
      .orderBy(documents.sequenceNumber);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching documents' });
  }
});

router.get('/execution-plans', async (req, res) => {
  try {
    const { status, notificationId } = req.query;
    
    let query = db.select().from(executionPlans);
    
    if (status) {
      query = query.where(eq(executionPlans.status, status as any)) as any;
    }
    
    if (notificationId) {
      query = query.where(eq(executionPlans.notificationId, parseInt(notificationId as string))) as any;
    }
    
    const plans = await query.orderBy(desc(executionPlans.createdAt)).limit(100);
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching execution plans' });
  }
});

router.get('/execution-plans/:id', async (req, res) => {
  try {
    const plan = await getPlanWithActions(parseInt(req.params.id));
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching execution plan' });
  }
});

router.post('/execution-plans/:id/approve', async (req: any, res) => {
  try {
    const planId = parseInt(req.params.id);
    const userId = req.user?.id || 1;
    
    await approvePlan(planId, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error approving plan' });
  }
});

router.post('/execution-plans/:id/cancel', async (req: any, res) => {
  try {
    const planId = parseInt(req.params.id);
    const userId = req.user?.id || 1;
    const { reason } = req.body;
    
    await cancelPlan(planId, userId, reason || 'Cancelled by user');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error cancelling plan' });
  }
});

router.post('/execution-plans/:id/execute', async (req: any, res) => {
  try {
    const planId = parseInt(req.params.id);
    
    await executePlan(planId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error executing plan' });
  }
});

router.put('/execution-plans/:planId/actions/:actionId', async (req: any, res) => {
  try {
    const { status, config } = req.body;
    const actionId = parseInt(req.params.actionId);
    
    const updateData: any = {};
    if (status) updateData.status = status;
    if (config) updateData.config = config;
    
    if (status === 'APPROVED') {
      updateData.approvedBy = req.user?.id || 1;
      updateData.approvedAt = new Date();
    }
    
    const [updated] = await db
      .update(executionActions)
      .set(updateData)
      .where(eq(executionActions.id, actionId))
      .returning();
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating action' });
  }
});

router.get('/triage', async (req, res) => {
  try {
    const triageItems = await db
      .select()
      .from(notifications)
      .where(eq(notifications.status, 'TRIAGE_REQUIRED'))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    res.json(triageItems);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching triage items' });
  }
});

router.post('/triage/:id/resolve', async (req: any, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const { inventoCaseId, inventoInstance, inventoFolder } = req.body;
    const userId = req.user?.id || 1;
    
    const [updated] = await db
      .update(notifications)
      .set({
        status: 'REVIEWED',
        inventoCaseId,
        inventoInstance,
        inventoFolder,
        triageResolvedBy: userId,
        triageResolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(notifications.id, notificationId))
      .returning();
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error resolving triage' });
  }
});

export default router;
