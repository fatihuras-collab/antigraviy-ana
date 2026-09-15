/**
 * AKŞAM RAPORU ROUTE'U (3 ÖĞÜNLÜ SİSTEM)
 * =======================================
 * Kahvaltı, Öğle Yemeği, İkindi Kahvaltısı
 *
 * GET /api/evening-report
 * GET /api/evening-report?date=YYYY-MM-DD
 *   - O günkü tüketim, kalan stok ve kritik seviye durumunu JSON olarak döner.
 *
 * GET /api/evening-report/send
 * GET /api/evening-report/send?date=YYYY-MM-DD
 *   - Raporu hemen hazırlayıp Telegram'a gönderir (elle test için).
 */

const express = require('express');
const router  = express.Router();
const {
  generateEveningReportData,
  sendEveningReportTelegram
} = require('../services/eveningReportService');

// ─── GET /api/evening-report/send ─────────────────────────────────────────────
// Saati beklemeden elle akşam raporunu Telegram'a gönderme ve test etme ucu
router.get('/send', async (req, res) => {
  try {
    const targetDate = req.query.date; // Opsiyonel YYYY-MM-DD
    const result = await sendEveningReportTelegram(targetDate);

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
      message: 'Akşam raporu Telegram\'a başarıyla gönderildi.',
      message_text: result.message_text,
      report: result.data
    });
  } catch (err) {
    console.error('[evening-report/send HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/evening-report ──────────────────────────────────────────────────
// Akşam raporu verisini getirir
router.get('/', async (req, res) => {
  try {
    const reportData = await generateEveningReportData(req.query.date);
    res.json(reportData);
  } catch (err) {
    console.error('[evening-report HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
