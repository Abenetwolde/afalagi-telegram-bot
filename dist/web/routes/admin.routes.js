"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const submission_model_1 = require("../../models/submission.model");
const logger_service_1 = require("../../services/logger.service");
const router = express_1.default.Router();
router.get("/submissions", async (req, res) => {
  try {
    const submissions = await submission_model_1.Submission.find();
    res.json(submissions);
  } catch (err) {
    logger_service_1.logger.error(`Error fetching submissions: ${err.message}`);
    res.status(500).json({ error: "Server error" });
  }
});
router.post("/submissions/:id/approve", async (req, res) => {
  try {
    const submission = await submission_model_1.Submission.findById(
      req.params.id,
    );
    if (submission) {
      submission.status = "approved";
      await submission.save();
      res.json({ message: "Submission approved" });
    } else {
      res.status(404).json({ error: "Submission not found" });
    }
  } catch (err) {
    logger_service_1.logger.error(`Error approving submission: ${err.message}`);
    res.status(500).json({ error: "Server error" });
  }
});
router.post("/submissions/:id/reject", async (req, res) => {
  try {
    const submission = await submission_model_1.Submission.findById(
      req.params.id,
    );
    if (submission) {
      submission.status = "rejected";
      await submission.save();
      res.json({ message: "Submission rejected" });
    } else {
      res.status(404).json({ error: "Submission not found" });
    }
  } catch (err) {
    logger_service_1.logger.error(`Error rejecting submission: ${err.message}`);
    res.status(500).json({ error: "Server error" });
  }
});
router.get("/stats", async (req, res) => {
  try {
    const totalSubmissions =
      await submission_model_1.Submission.countDocuments();
    const approvedSubmissions =
      await submission_model_1.Submission.countDocuments({
        status: "approved",
      });
    res.json({ totalSubmissions, approvedSubmissions });
  } catch (err) {
    logger_service_1.logger.error(`Error fetching stats: ${err.message}`);
    res.status(500).json({ error: "Server error" });
  }
});
