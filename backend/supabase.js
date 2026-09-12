const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Yerel geliştirme için .env dosyası varsa yükle; cloud/Railway ortamında process.env doğrudan kullanılır
const rootEnv = path.join(__dirname, '../.env');
const localEnv = path.join(__dirname, '.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
}

// Tırnak işaretlerini ve boşlukları temizleme yardımcısı
const cleanEnv = (val) => (val || '').trim().replace(/^["']|["']$/g, '');

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = cleanEnv(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  const detectedKeys = Object.keys(process.env).filter(k =>
    k.toUpperCase().includes('SUPABASE') || k.toUpperCase().includes('RAILWAY') || k === 'PORT' || k === 'NODE_ENV'
  );

  console.error('\n❌ [HATA] Supabase ortam değişkenleri bulunamadı!');
  console.error(`   SUPABASE_URL: ${SUPABASE_URL ? '✓ Algılandı' : '✗ EKSİK'}`);
  console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✓ Algılandı' : '✗ EKSİK'}`);
  console.error(`   Algılanan ilgili değişkenler: [${detectedKeys.join(', ')}]`);
  console.error('   Lütfen Railway Variables sekmesinde SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanimlandigından emin olun.\n');

  // throw yerine null export — sunucu ayağa kalksın, route'lar hata dönsün
  module.exports = null;
} else {
  // service_role key: RLS'i bypass eder — sadece backend'de kullan!
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  console.log('✅ Supabase bağlantısı başarıyla kuruldu.');
  module.exports = supabase;
}
