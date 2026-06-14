import { Router } from 'express';
import { ScanService } from '../services/scan.service';
import { AIService } from '../services/ai.service';

const router = Router();

// Endpoint to simulate Network Scans
router.get('/scan', (req, res) => {
  try {
    const range = (req.query.range as string) || '10.20.1.0-5.0';
    const scanResult = ScanService.performScan(range);
    res.json(scanResult);
  } catch (error: any) {
    console.error('Scan routing failure:', error);
    res.status(500).json({ error: 'Failed to execute discovery scan simulation.' });
  }
});

// Endpoint to execute AI Network Diagnostics securely 
router.post('/diagnose', async (req, res) => {
  try {
    const { scanData, provider, apiKey, model, apiUrl } = req.body;
    
    if (!scanData) {
      return res.status(400).json({ error: 'Missing required field: scanData' });
    }

    const diagnosis = await AIService.diagnose({
      scanData,
      provider: provider || 'gemini',
      apiKey,
      model,
      apiUrl
    });

    res.json(diagnosis);
  } catch (error: any) {
    console.error('AI diagnosis routing failure:', error);
    res.status(500).json({ error: error.message || 'Failed to complete AI diagnostic check.' });
  }
});

export { router as apiRouter };
