/**
 * YEMEK GERİ BİLDİRİM ROUTE'U
 *
 * POST /api/meal-feedback
 * GET  /api/meal-feedback
 *
 * İşlev:
 *   - Yemek sonrası geri bildirim kaydeder ('az', 'normal', 'cok').
 *   - Aynı tarih ve recipe_id için tekrar girilirse üzerine yazar (günceller).
 *   - Personelin gün içinde fikrini değiştirebilmesine olanak tanır.
 */

const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

const VALID_LEVELS = ['az', 'normal', 'cok'];

// ─── POST /api/meal-feedback ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { recipe_id, feedback_level, date, feedback_date } = req.body;

    // 1. Validasyon: recipe_id
    if (!recipe_id) {
      return res.status(400).json({
        success: false,
        error: 'recipe_id zorunludur.'
      });
    }

    const rid = parseInt(recipe_id, 10);
    if (isNaN(rid) || rid <= 0) {
      return res.status(400).json({
        success: false,
        error: 'recipe_id geçerli bir sayı olmalıdır.'
      });
    }

    // 2. Validasyon: feedback_level
    if (!feedback_level || typeof feedback_level !== 'string') {
      return res.status(400).json({
        success: false,
        error: `feedback_level zorunludur. Geçerli değerler: ${VALID_LEVELS.join(', ')}`
      });
    }

    const level = feedback_level.trim().toLowerCase();
    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({
        success: false,
        error: `Geçersiz feedback_level ('${feedback_level}'). Şunlardan biri olmalıdır: ${VALID_LEVELS.join(', ')}`
      });
    }

    // 3. Tarih belirleme (varsayılan: bugün)
    const targetDate = date || feedback_date || new Date().toISOString().split('T')[0];

    // 4. Reçete var mı kontrol et
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .select('id, meal_name')
      .eq('id', rid)
      .single();

    if (recipeErr || !recipe) {
      return res.status(404).json({
        success: false,
        error: `recipe_id=${rid} olan yemek bulunamadı.`
      });
    }

    // 5. Aynı tarih ve recipe için mevcut kayıt var mı?
    const { data: existingList, error: checkErr } = await supabase
      .from('meal_feedback')
      .select('id, feedback_date, recipe_id, feedback_level, created_at')
      .eq('feedback_date', targetDate)
      .eq('recipe_id', rid);

    if (checkErr) throw checkErr;

    let resultRecord = null;
    let isUpdated = false;

    if (existingList && existingList.length > 0) {
      // ── Var olan kaydı güncelle ───────────────────────────────────────────
      const existingId = existingList[0].id;
      const oldLevel   = existingList[0].feedback_level;

      const { data: updated, error: updErr } = await supabase
        .from('meal_feedback')
        .update({
          feedback_level: level,
          created_at:     new Date().toISOString()
        })
        .eq('id', existingId)
        .select()
        .single();

      if (updErr) throw updErr;

      resultRecord = updated;
      isUpdated = true;

      return res.status(200).json({
        success: true,
        action: 'updated',
        message: `${recipe.meal_name} için ${targetDate} tarihindeki geri bildirim güncellendi: '${oldLevel}' ➔ '${level}'.`,
        data: {
          id:             resultRecord.id,
          feedback_date:  resultRecord.feedback_date,
          recipe_id:      rid,
          recipe_name:    recipe.meal_name,
          feedback_level: resultRecord.feedback_level,
          previous_level: oldLevel,
          updated_at:     resultRecord.created_at
        }
      });

    } else {
      // ── Yeni kayıt ekle ───────────────────────────────────────────────────
      const { data: inserted, error: insErr } = await supabase
        .from('meal_feedback')
        .insert([{
          feedback_date:  targetDate,
          recipe_id:      rid,
          feedback_level: level
        }])
        .select()
        .single();

      if (insErr) throw insErr;

      resultRecord = inserted;

      return res.status(201).json({
        success: true,
        action: 'created',
        message: `${recipe.meal_name} için ${targetDate} tarihindeki geri bildirim kaydedildi: '${level}'.`,
        data: {
          id:             resultRecord.id,
          feedback_date:  resultRecord.feedback_date,
          recipe_id:      rid,
          recipe_name:    recipe.meal_name,
          feedback_level: resultRecord.feedback_level,
          created_at:     resultRecord.created_at
        }
      });
    }

  } catch (err) {
    console.error('[meal-feedback HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/meal-feedback ───────────────────────────────────────────────────
// Kayıtlı geri bildirimleri listeler (?date=YYYY-MM-DD, ?recipe_id=X)
router.get('/', async (req, res) => {
  try {
    let query = supabase
      .from('meal_feedback')
      .select(`
        id,
        feedback_date,
        feedback_level,
        created_at,
        recipes (
          id,
          meal_name
        )
      `)
      .order('feedback_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (req.query.date) {
      query = query.eq('feedback_date', req.query.date);
    }
    if (req.query.recipe_id) {
      query = query.eq('recipe_id', parseInt(req.query.recipe_id, 10));
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      count: data?.length || 0,
      data: (data || []).map(row => ({
        id:             row.id,
        feedback_date:  row.feedback_date,
        recipe_id:      row.recipes?.id,
        recipe_name:    row.recipes?.meal_name,
        feedback_level: row.feedback_level,
        created_at:     row.created_at
      }))
    });

  } catch (err) {
    console.error('[GET meal-feedback HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ─── GET /api/today-meals-with-feedback ──────────────────────────────────────
// Bugünün 3 öğününü, mevcut feedback durumunu ve "az yenildi" uyarı bilgisini döndürür
const WEEK_BASE_DATES = {
  1: '2026-09-07',
  2: '2026-09-14',
  3: '2026-09-21',
  4: '2026-09-28'
};

const GUN_ISIMLERI = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar'
};

// ─── GET /api/meal-feedback/today ─────────────────────────────────────────────
// Belirtilen haftanın veya günün 3 öğününü, feedback durumunu ve uyarı bilgisini döndürür
// Parametreler: ?week=1..4 & day=1..5 VEYA ?date=YYYY-MM-DD
router.get('/today', async (req, res) => {
  try {
    let weekNumber = req.query.week ? parseInt(req.query.week, 10) : null;
    let dayOfWeek  = req.query.day  ? parseInt(req.query.day, 10)  : null;
    let targetDate = req.query.date;

    // Eğer tarih yoksa, hafta ve gün varsa tarihi o haftaya göre hesapla
    if (!targetDate) {
      if (weekNumber && dayOfWeek) {
        const base = new Date(WEEK_BASE_DATES[weekNumber] || '2026-09-07');
        base.setDate(base.getDate() + (dayOfWeek - 1));
        targetDate = base.toISOString().split('T')[0];
      } else {
        targetDate = new Date().toISOString().split('T')[0];
      }
    }

    if (!dayOfWeek) {
      dayOfWeek = ((new Date(targetDate + 'T12:00:00').getDay() + 6) % 7) + 1;
      if (dayOfWeek > 5) dayOfWeek = 5; // Haftasonu ise Cuma gününü baz al
    }

    if (!weekNumber) {
      const dNum = new Date(targetDate + 'T12:00:00').getDate();
      weekNumber = Math.min(4, Math.max(1, Math.floor((dNum - 1) / 7) + 1));
    }

    // 1. ÖNCELİK 1: monthly_menu tablosunda bu tarih için kayıt var mı?
    let menuRows = null;
    try {
      const { data: mRows, error: mErr } = await supabase
        .from('monthly_menu')
        .select(`
          id,
          meal_type,
          menu_date,
          recipes (
            id,
            meal_name,
            meal_type
          )
        `)
        .eq('menu_date', targetDate);

      if (!mErr && mRows && mRows.length > 0) {
        menuRows = mRows;
      }
    } catch (e) {
      // monthly_menu yoksa weekly_menu fallback
    }

    // ÖNCELİK 2: weekly_menu fallback
    if (!menuRows || menuRows.length === 0) {
      const weekValidFrom = WEEK_BASE_DATES[weekNumber] || '2026-09-07';
      let { data: wRows, error: menuErr } = await supabase
        .from('weekly_menu')
        .select(`
          id,
          day_of_week,
          meal_type,
          valid_from,
          recipes (
            id,
            meal_name,
            meal_type
          )
        `)
        .eq('day_of_week', dayOfWeek)
        .eq('valid_from', weekValidFrom);

      if (menuErr) throw menuErr;
      menuRows = wRows;

      // Fallback: Eğer o valid_from ile bulunamadıysa sadece day_of_week ile dene
      if (!menuRows || menuRows.length === 0) {
        const { data: fallbackRows } = await supabase
          .from('weekly_menu')
          .select(`
            id,
            day_of_week,
            meal_type,
            valid_from,
            recipes (
              id,
              meal_name,
              meal_type
            )
          `)
          .eq('day_of_week', dayOfWeek);
        menuRows = fallbackRows || [];
      }
    }

    if (!menuRows || menuRows.length === 0) {
      return res.json({
        success: true,
        date: targetDate,
        week_number: weekNumber,
        day_of_week: dayOfWeek,
        day_name: GUN_ISIMLERI[dayOfWeek] || '',
        meals: []
      });
    }

    // 2. Bugünkü / seçilen tarihteki mevcut feedback kayıtları
    const recipeIds = menuRows.map(r => r.recipes?.id).filter(Boolean);
    const { data: todayFeedback, error: fbErr } = await supabase
      .from('meal_feedback')
      .select('recipe_id, feedback_level, feedback_date')
      .eq('feedback_date', targetDate)
      .in('recipe_id', recipeIds);

    if (fbErr) throw fbErr;

    const todayFbMap = {};
    (todayFeedback || []).forEach(fb => {
      todayFbMap[fb.recipe_id] = fb.feedback_level;
    });

    // 3. Her reçete için son 5 pişirimin feedback geçmişi
    const { data: historyRows, error: histErr } = await supabase
      .from('meal_feedback')
      .select('recipe_id, feedback_level, feedback_date')
      .in('recipe_id', recipeIds)
      .order('feedback_date', { ascending: false })
      .limit(50);

    if (histErr) throw histErr;

    const historyByRecipe = {};
    (historyRows || []).forEach(row => {
      if (!historyByRecipe[row.recipe_id]) historyByRecipe[row.recipe_id] = [];
      if (historyByRecipe[row.recipe_id].length < 5) {
        historyByRecipe[row.recipe_id].push(row.feedback_level);
      }
    });

    // 4. Öğün sırasına göre sırala ve yanıtı oluştur
    const OGUN_SIRASI = ['kahvalti', 'ogle', 'ikindi'];
    const OGUN_LABEL  = { kahvalti: 'Kahvaltı', ogle: 'Öğle Yemeği', ikindi: 'İkindi Kahvaltısı' };

    const meals = menuRows
      .sort((a, b) => OGUN_SIRASI.indexOf(a.meal_type) - OGUN_SIRASI.indexOf(b.meal_type))
      .map(row => {
        const recipeId    = row.recipes?.id;
        const history     = historyByRecipe[recipeId] || [];
        const azCount     = history.filter(l => l === 'az').length;
        const showWarning = history.length >= 3 && azCount >= 3;

        return {
          menu_id:          row.id,
          meal_type:        row.meal_type,
          meal_label:       OGUN_LABEL[row.meal_type] || row.meal_type,
          recipe_id:        recipeId,
          recipe_name:      row.recipes?.meal_name,
          current_feedback: todayFbMap[recipeId] || null,
          warning:          showWarning,
          history_count:    history.length,
          az_count:         azCount
        };
      });

    res.json({
      success:     true,
      date:        targetDate,
      week_number: weekNumber,
      day_of_week: dayOfWeek,
      day_name:    GUN_ISIMLERI[dayOfWeek] || '',
      meals
    });

  } catch (err) {
    console.error('[today-meals-with-feedback HATA]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/meal-feedback/monthly-overview ──────────────────────────────────
// 4 haftanın tüm menü planını (20 gün x 3 öğün) döner
router.get('/monthly-overview', async (req, res) => {
  try {
    // 1. ÖNCELİK: monthly_menu tablosundan çek (AI ile yüklenen gerçek aylık menü)
    const { data: mRows, error: mErr } = await supabase
      .from('monthly_menu')
      .select(`
        id,
        date,
        day_of_week,
        week_number,
        meal_type,
        recipe_id,
        recipes (
          id,
          meal_name,
          meal_type
        )
      `)
      .order('date')
      .order('day_of_week');

    if (!mErr && mRows && mRows.length > 0) {
      const grouped = { 1: {}, 2: {}, 3: {}, 4: {} };
      mRows.forEach(r => {
        const w = r.week_number || 1;
        const d = r.day_of_week;
        if (!grouped[w]) grouped[w] = {};
        if (!grouped[w][d]) grouped[w][d] = {};
        grouped[w][d][r.meal_type] = {
          recipe_id:   r.recipes?.id || r.recipe_id,
          recipe_name: r.recipes?.meal_name,
          date:        r.date
        };
      });

      return res.json({ success: true, weeks: grouped, source: 'monthly_menu' });
    }

    // 2. FALLBACK: weekly_menu tablosu
    const { data: rows, error } = await supabase
      .from('weekly_menu')
      .select(`
        id,
        day_of_week,
        meal_type,
        valid_from,
        recipes (
          id,
          meal_name,
          meal_type
        )
      `)
      .order('valid_from')
      .order('day_of_week');

    if (error) throw error;

    const validFromToWeek = {
      '2026-09-07': 1,
      '2026-09-14': 2,
      '2026-09-21': 3,
      '2026-09-28': 4
    };

    const grouped = { 1: {}, 2: {}, 3: {}, 4: {} };
    (rows || []).forEach(r => {
      const w = validFromToWeek[r.valid_from] || 1;
      const d = r.day_of_week;
      if (!grouped[w]) grouped[w] = {};
      if (!grouped[w][d]) grouped[w][d] = {};
      grouped[w][d][r.meal_type] = {
        recipe_id:   r.recipes?.id,
        recipe_name: r.recipes?.meal_name
      };
    });

    res.json({ success: true, weeks: grouped, source: 'weekly_menu' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
