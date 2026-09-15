/**
 * ZAMANLANMIŞ GÖREVLER (SCHEDULER) SERVİSİ
 * ========================================
 * Belirli saatlerde otomatik çalışan cron görevlerini yönetir.
 * 
 * 1. Günlük Akşam Raporu:
 *    - Her gün saat 18:00'de (Türkiye Saati: Europe/Istanbul)
 *    - O günün yemek/stok özetini Telegram'a otomatik iletir.
 * 
 * 2. Haftalık Genel Rapor:
 *    - Her Cuma saat 12:00'de (Türkiye Saati: Europe/Istanbul)
 *    - Son 7 günün stok analizini Telegram'a otomatik iletir.
 */

const cron = require('node-cron');
const { sendEveningReportTelegram } = require('./eveningReportService');
const { sendWeeklyReportTelegram }  = require('./weeklyReportService');

let eveningReportJob = null;
let weeklyReportJob  = null;

function initScheduler() {
  const timezone = process.env.TZ || 'Europe/Istanbul';

  // ── 1. Günlük Akşam Raporu Zamanlayıcısı (Her gün 18:00) ───────────────────
  const eveningCron = process.env.EVENING_REPORT_CRON || '0 18 * * *';
  if (!cron.validate(eveningCron)) {
    console.error(`[Scheduler] ❌ Geçersiz akşam raporu cron ifadesi: ${eveningCron}`);
  } else {
    if (eveningReportJob) {
      eveningReportJob.stop();
    }

    eveningReportJob = cron.schedule(eveningCron, async () => {
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

    console.log(`[Scheduler] 🕒 Otomatik Akşam Raporu zamanlayıcısı kuruldu: "${eveningCron}" (Saat Dilimi: ${timezone})`);
  }

  // ── 2. Haftalık Genel Rapor Zamanlayıcısı (Her Cuma 12:00) ─────────────────
  const weeklyCron = process.env.WEEKLY_REPORT_CRON || '0 12 * * 5';
  if (!cron.validate(weeklyCron)) {
    console.error(`[Scheduler] ❌ Geçersiz haftalık rapor cron ifadesi: ${weeklyCron}`);
  } else {
    if (weeklyReportJob) {
      weeklyReportJob.stop();
    }

    weeklyReportJob = cron.schedule(weeklyCron, async () => {
      console.log(`[Scheduler] ⏰ Zamanlanmış Haftalık Rapor tetiklendi: ${new Date().toISOString()}`);
      try {
        const res = await sendWeeklyReportTelegram();
        if (res.success) {
          console.log('[Scheduler] ✅ Haftalık rapor Telegram\'a başarıyla iletildi.');
        } else {
          console.warn('[Scheduler] ⚠️ Haftalık rapor iletilemedi:', res.error || res.reason);
        }
      } catch (err) {
        console.error('[Scheduler] ❌ Haftalık rapor çalıştırma hatası:', err.message);
      }
    }, {
      scheduled: true,
      timezone: timezone
    });

    console.log(`[Scheduler] 🕒 Otomatik Haftalık Rapor zamanlayıcısı kuruldu: "${weeklyCron}" (Saat Dilimi: ${timezone})`);
  }

  return { eveningReportJob, weeklyReportJob };
}

function getSchedulerStatus() {
  return {
    evening_report_active: !!eveningReportJob,
    weekly_report_active:  !!weeklyReportJob,
    evening_cron:          process.env.EVENING_REPORT_CRON || '0 18 * * *',
    weekly_cron:           process.env.WEEKLY_REPORT_CRON || '0 12 * * 5',
    timezone:              process.env.TZ || 'Europe/Istanbul'
  };
}

module.exports = {
  initScheduler,
  getSchedulerStatus
};
