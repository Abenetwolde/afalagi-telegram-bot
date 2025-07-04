import express from 'express';
import { Submission } from '../../models/submission.model';
import { logger } from '../../services/logger.service';

const router = express.Router();

router.get('/submissions', async (req, res) => {
  try {
    const submissions = await Submission.find();
    res.json(submissions);
  } catch (err) {
    logger.error(`Error fetching submissions: ${err.message}`);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/submissions/:id/approve', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (submission) {
      submission.status = 'approved';
      await submission.save();
      res.json({ message: 'Submission approved' });
    } else {
      res.status(404).json({ error: 'Submission not found' });
    }
  } catch (err) {
    logger.error(`Error approving submission: ${err.message}`);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/submissions/:id/reject', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (submission) {
      submission.status = 'rejected';
      await submission.save();
      res.json({ message: 'Submission rejected' });
    } else {
      res.status(404).json({ error: 'Submission not found' });
    }
  } catch (err) {
    logger.error(`Error rejecting submission: ${err.message}`);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const totalSubmissions = await Submission.countDocuments();
    const approvedSubmissions = await Submission.countDocuments({ status: 'approved' });
    res.json({ totalSubmissions, approvedSubmissions });
  } catch (err) {
    logger.error(`Error fetching stats: ${err.message}`);
    res.status(500).json({ error: 'Server error' });
  }
});