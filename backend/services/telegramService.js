/**
 * TELEGRAM SERVİSİ
 * Telegram Bot API üzerinden bildirim mesajları gönderme servisi.
 * TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID ortam değişkenlerini kullanır.
 */

const cleanEnv = (val) => (val || '').toString().trim().replace(/^["']|["']$/g, '');

function getTelegramConfig() {
  const token  = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = cleanEnv(process.env.TELEGRAM_CHAT_ID);
  return { token, chatId };
}

/**
 * Telegram üzerinden belirtilen metni gönderir.
 * @param {string} text - Gönderilecek mesaj metni
 * @returns {Promise<{success: boolean, data?: any, error?: any, reason?: string}>}
 */
async function sendTelegramMessage(text) {
  const { token, chatId } = getTelegramConfig();

  if (!token || !chatId) {
    console.warn('[Telegram Alert] TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID tanımlı değil. Bildirim atlandı.');
    return { success: false, reason: 'missing_credentials' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.error('[Telegram Alert Hatası]', data);
      return { success: false, error: data };
    }

    console.log('[Telegram Alert] Bildirim başarıyla gönderildi:', text);
    return { success: true, data };
  } catch (err) {
    console.error('[Telegram Alert Bağlantı Hatası]', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getTelegramConfig,
  sendTelegramMessage
};
