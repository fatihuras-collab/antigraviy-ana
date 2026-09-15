/**
 * HAFTALIK GENEL RAPOR ROUTE'U
 * =============================
 *
 * GET /api/weekly-report
 * GET /api/weekly-report?date=YYYY-MM-DD
 * GET /api/weekly-report?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *   - Son 7 günün stok analiz verilerini JSON olarak döner.
 *
 * GET /api/weekly-report/send
 * GET /api/weekly-report/send?date=YYYY-MM-DD
 * GET /api/weekly-report/send?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *   - Haftalık raporu hemen hazırlayıp Telegram'a gönderir (elle test için).
 */

const express = require('express');
const router  = express.Router();
const {
  generateWeeklyReportData,
  sendWeeklyReportTelegram
} = require('../services/weeklyReportService');

// ─── GET /api/weekly-report/send ──────────────────────────────────────────────
// Saati beklemeden elle haftalık raporu Telegram'a gönderme ve test etme ucu
router.get('/send', async (req, res) => {
  try {
    const options = {
      startDate: req.query.start_date,
      endDate:   req.query.end_date || req.query.date
    };

    const result = await sendWeeklyReportTelegram(options);

    if (!result.success) {
      const statusCode = result.reason === 'missing_credentials' ? 400 : 502;
      return res.status(statusCode).json({
        success: false,
        error: result.error || (result.reason === 'missing_credentials' ? 'TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID eksik' : 'Telegram mesajı iletilemedi.'),
        reason: result.reason,
        message_text: result.message_text,
        report: result.data
      });
    }

    res.json({
      success: true,
      message: 'Haftalık rapor Telegram\'a başarıyla gönderildi.',
      message_text: result.message_text,
      report: result.data
    });
  } catch (err) {
    console.error('[weekly-report/send HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/weekly-report ───────────────────────────────────────────────────
// Haftalık rapor verisini JSON olarak döner
router.get('/', async (req, res) => {
  try {
    const options = {
      startDate: req.query.start_date,
      endDate:   req.query.end_date || req.query.date
    };
    const reportData = await generateWeeklyReportData(options);
    res.json(reportData);
  } catch (err) {
    console.error('[weekly-report HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
