/**
 * ZAMANLANMIŞ GÖREVLER (SCHEDULER) SERVİSİ
 * ========================================
 * Belirli saatlerde otomatik çalışan cron görevlerini yönetir.
 * 
 * - Akşam Raporu: Her gün saat 18:00'de (Türkiye Saati: Europe/Istanbul)
 *   o günün özetini Telegram'a otomatik iletir.
 */

const cron = require('node-cron');
const { sendEveningReportTelegram } = require('./eveningReportService');

let eveningReportJob = null;

function initScheduler() {
  const cronExpr = process.env.EVENING_REPORT_CRON || '0 18 * * *';
  const timezone = process.env.TZ || 'Europe/Istanbul';

  if (!cron.validate(cronExpr)) {
    console.error(`[Scheduler] ❌ Geçersiz cron ifadesi: ${cronExpr}`);
    return null;
  }

  // Önceki iş varsa durdur
  if (eveningReportJob) {
    eveningReportJob.stop();
  }

  eveningReportJob = cron.schedule(cronExpr, async () => {
    console.log(`[Scheduler] ⏰ Zamanlanmış Akşam Raporu tetiklendi: ${new Date().toISOString()}`);
    try {
      const res = await sendEveningReportTelegram();
      if (res.success) {
        console.log('[Scheduler] ✅ Akşam raporu Telegram\'a başarıyla iletildi.');
      } else {
        console.warn('[Scheduler] ⚠️ Akşam raporu iletilemedi:', res.error || res.reason);
      }
    } catch (err) {
      console.error('[Scheduler] ❌ Akşam raporu çalıştırma hatası:', err.message);
    }
  }, {
    scheduled: true,
    timezone: timezone
  });

  console.log(`[Scheduler] 🕒 Otomatik Akşam Raporu zamanlayıcısı kuruldu: "${cronExpr}" (Saat Dilimi: ${timezone})`);
  return eveningReportJob;
}

function getSchedulerStatus() {
  return {
    evening_report_active: !!eveningReportJob,
    cron_expression: process.env.EVENING_REPORT_CRON || '0 18 * * *',
    timezone: process.env.TZ || 'Europe/Istanbul'
  };
}

module.exports = {
  initScheduler,
  getSchedulerStatus
};
