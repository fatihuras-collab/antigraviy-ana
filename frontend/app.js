/**
 * ANAOKULU YEMEKHANE STOK PANELİ — CLIENT SCRIPTI
 * ===============================================
 */

// Otomatik API taban adresi belirleme (aynı origin veya localhost:3000)
const API_BASE_URL = window.location.origin.includes('http') && !window.location.origin.includes('file:')
  ? window.location.origin
  : 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
  initDateDisplay();
  initQuickChips();
  initFormHandler();
  // Ayarları yükle ve UI'a yansıt
  loadSettings();
  // Geri bildirim sekmesi açıkken öğünleri otomatik yükle
  loadFeedbackMeals();
});

// ─────────────────────────────────────────────────────────────────────────────
// TAB NAVİGASYONU
// ─────────────────────────────────────────────────────────────────────────────

function switchTab(tabName) {
  const panels = {
    consumption: 'panel-consumption',
    feedback:    'panel-feedback',
    menu:        'panel-menu',
    manage:      'panel-manage'
  };
  const tabs = {
    consumption: 'tab-consumption',
    feedback:    'tab-feedback',
    menu:        'tab-menu',
    manage:      'tab-manage'
  };

  Object.values(panels).forEach(id => document.getElementById(id)?.classList.add('hidden'));
  Object.values(tabs).forEach(id => {
    const el = document.getElementById(id);
    el?.classList.remove('tab-active');
    el?.setAttribute('aria-selected', 'false');
  });

  document.getElementById(panels[tabName])?.classList.remove('hidden');
  const activeTab = document.getElementById(tabs[tabName]);
  activeTab?.classList.add('tab-active');
  activeTab?.setAttribute('aria-selected', 'true');

  if (tabName === 'feedback') loadFeedbackMeals();
  if (tabName === 'menu')     loadMonthlyMenu();
  if (tabName === 'manage')   loadManagePanel();
}

// ─────────────────────────────────────────────────────────────────────────────
// TARİH GÖSTERGESI
// ─────────────────────────────────────────────────────────────────────────────

function initDateDisplay() {
  const dateBadge = document.getElementById('today-date-badge');
  if (!dateBadge) return;
  const now = new Date();
  const options = { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' };
  dateBadge.textContent = now.toLocaleDateString('tr-TR', options);
}

// ─────────────────────────────────────────────────────────────────────────────
// HIZLI PORSIYON SEÇİM BUTONLARI
// ─────────────────────────────────────────────────────────────────────────────

function initQuickChips() {
  const chips = document.querySelectorAll('.chip-btn');
  const input = document.getElementById('portion-input');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (input) {
        input.value = chip.getAttribute('data-val');
        input.focus();
      }
    });
  });

  if (input) {
    input.addEventListener('input', () => {
      chips.forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-val') === input.value);
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TÜKETİM FORMU (POST /api/daily-consumption)
// ─────────────────────────────────────────────────────────────────────────────

function initFormHandler() {
  const applyBtn = document.getElementById('apply-btn');
  const portionInput = document.getElementById('portion-input');

  if (!applyBtn || !portionInput) return;

  applyBtn.addEventListener('click', async () => {
    const count = parseInt(portionInput.value, 10);

    if (isNaN(count) || count <= 0) {
      showAlert('Geçersiz Değer', 'Lütfen 1 veya daha büyük bir öğrenci sayısı girin.', 'error');
      portionInput.focus();
      return;
    }

    setLoading(true);
    hideAlert();
    hideResults();

    try {
      const response = await fetch(`${API_BASE_URL}/api/daily-consumption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portion_count: count })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          showAlert(
            '⚠️ Tüketim Zaten İşlenmiş',
            data.error || 'Bugün için günlük tüketim kaydı zaten yapılmış. Tekrar işlenemez.',
            'error'
          );
        } else {
          showAlert('Hata Oluştu', data.error || 'İşlem sırasında bir sorun oluştu.', 'error');
        }
        return;
      }

      renderResults(data);
      // Tüketim başarılı olduktan sonra feedback sekmesini güncelle
      loadFeedbackMeals();

    } catch (err) {
      console.error('[API Hatası]', err);
      showAlert(
        'Bağlantı Hatası',
        `Sunucuya erişilemedi (${API_BASE_URL}). Sunucunun (server.js) çalıştığından emin olun.`,
        'error'
      );
    } finally {
      setLoading(false);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SONUÇ KARTI (3 ÖĞÜNLÜ)
// ─────────────────────────────────────────────────────────────────────────────

function renderResults(data) {
  const resultSection  = document.getElementById('result-section');
  const recipeName     = document.getElementById('res-recipe-name');
  const metaInfo       = document.getElementById('res-meta-info');
  const ingCount       = document.getElementById('stat-ingredients-count');
  const portionCount   = document.getElementById('stat-portion-count');
  const mealsCount     = document.getElementById('stat-meals-count');
  const mealsContainer = document.getElementById('meals-cards-container');
  const tableBody      = document.getElementById('consumption-table-body');

  if (!resultSection || !tableBody) return;

  if (recipeName) recipeName.textContent = 'Günlük 3 Öğün Tüketimi';
  if (metaInfo) {
    metaInfo.textContent = `${data.portion_count} Öğrenci • ${data.day_name || ''} (${data.date || ''})`;
  }

  const items = data.consumption || [];
  const meals = data.meals || [];

  if (ingCount)     ingCount.textContent = `${items.length} Çeşit`;
  if (portionCount) portionCount.textContent = `${data.portion_count} Kişi`;
  if (mealsCount)   mealsCount.textContent = `${meals.length || 3} Öğün`;

  // 3 Öğün Kartları
  if (mealsContainer) {
    mealsContainer.innerHTML = '';
    meals.forEach(meal => {
      const card  = document.createElement('div');
      const mType = meal.meal_type || 'ogle';
      card.className = `meal-card meal-card-${mType}`;

      const icon = mType === 'kahvalti' ? '🌅' : (mType === 'ogle' ? '🍲' : '🍪');

      let itemsHtml = '';
      (meal.items || []).forEach(it => {
        itemsHtml += `
          <div class="meal-item-row">
            <span>${escapeHtml(it.name)}</span>
            <span class="meal-item-qty">${formatNumber(it.needed)} ${it.unit}</span>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="meal-card-top">
          <span class="meal-type-pill pill-${mType}">${icon} ${escapeHtml(meal.meal_label || mType)}</span>
          <span class="item-unit">${data.portion_count} Porsiyon</span>
        </div>
        <h4 class="meal-recipe-name">${escapeHtml(meal.recipe?.name || meal.meal_name || 'Menü')}</h4>
        <div class="meal-items-box">
          ${itemsHtml}
        </div>
      `;
      mealsContainer.appendChild(card);
    });
  }

  // Konsolide Tablo
  tableBody.innerHTML = '';
  items.forEach(item => {
    const tr = document.createElement('tr');

    let statusBadge = '<span class="status-pill status-pill-ok">Yeterli</span>';
    if (item.is_critical || item.stock_after <= 0) {
      statusBadge = '<span class="status-pill status-pill-crit">Kritik</span>';
    } else if (item.stock_after < 5) {
      statusBadge = '<span class="status-pill status-pill-warn">Azaldı</span>';
    }

    tr.innerHTML = `
      <td>
        <span class="item-name">${escapeHtml(item.name)}</span>
      </td>
      <td class="text-right consumed-cell">
        -${formatNumber(item.consumed)} <span class="item-unit">${item.unit}</span>
      </td>
      <td class="text-right">
        ${formatNumber(item.stock_before)} <span class="item-unit">${item.unit}</span>
      </td>
      <td class="text-right remaining-cell">
        ${formatNumber(item.stock_after)} <span class="item-unit">${item.unit}</span>
      </td>
      <td class="text-center">
        ${statusBadge}
      </td>
    `;
    tableBody.appendChild(tr);
  });

  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─────────────────────────────────────────────────────────────────────────────
// GERİ BİLDİRİM EKRANI (4 HAFTA & GÜN SEÇİCİ DESTEKLİ)
// ─────────────────────────────────────────────────────────────────────────────

let currentFeedbackWeek = 1;
let currentFeedbackDay  = 1;
let currentFeedbackDate = null;

function selectFeedbackWeek(week) {
  currentFeedbackWeek = week;
  document.querySelectorAll('#fb-week-pills .pill-btn').forEach(btn => {
    const w = parseInt(btn.getAttribute('data-week'), 10);
    btn.classList.toggle('active', w === week);
  });
  loadFeedbackMeals(currentFeedbackWeek, currentFeedbackDay);
}

function selectFeedbackDay(day) {
  currentFeedbackDay = day;
  document.querySelectorAll('#fb-day-pills .pill-btn').forEach(btn => {
    const d = parseInt(btn.getAttribute('data-day'), 10);
    btn.classList.toggle('active', d === day);
  });
  loadFeedbackMeals(currentFeedbackWeek, currentFeedbackDay);
}

async function loadFeedbackMeals(week = currentFeedbackWeek, day = currentFeedbackDay) {
  const loadingEl  = document.getElementById('feedback-loading');
  const emptyEl    = document.getElementById('feedback-empty');
  const gridEl     = document.getElementById('feedback-cards-grid');
  const bannerText = document.getElementById('active-day-text');

  if (!loadingEl || !emptyEl || !gridEl) return;

  // Yükleniyor durumu
  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  gridEl.classList.add('hidden');
  gridEl.innerHTML = '';

  try {
    const res  = await fetch(`${API_BASE_URL}/api/meal-feedback/today?week=${week}&day=${day}`);
    const data = await res.json();

    loadingEl.classList.add('hidden');

    if (!data.success || !data.meals || data.meals.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }

    currentFeedbackDate = data.date;
    if (bannerText) {
      const ageGroup = currentSettings?.target_age_group || '2-6 Yaş Grubu';
      bannerText.textContent = `${data.week_number}. Hafta • ${data.day_name} Menüsü (Tarih: ${data.date}) • ${ageGroup}`;
    }

    renderFeedbackCards(data.meals);
    gridEl.classList.remove('hidden');

  } catch (err) {
    console.error('[Feedback yükleme hatası]', err);
    loadingEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
  }
}

function renderFeedbackCards(meals) {
  const grid = document.getElementById('feedback-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const ICONS = { kahvalti: '🌅', ogle: '🍲', ikindi: '🍪' };

  meals.forEach(meal => {
    const card = document.createElement('div');
    card.className = `feedback-card feedback-card-${meal.meal_type}`;
    card.id = `fcard-${meal.recipe_id}`;

    const icon = ICONS[meal.meal_type] || '🍽️';

    // Uyarı notu HTML'i
    const warningHtml = meal.warning ? `
      <div class="feedback-warning-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>Bu yemek son pişirimlerde sık az yenildi — haftalık raporda öneri göreceksiniz.</span>
      </div>
    ` : '';

    card.innerHTML = `
      <div class="feedback-card-top">
        <span class="meal-type-pill pill-${meal.meal_type}">${icon} ${escapeHtml(meal.meal_label)}</span>
        <span class="recipe-type-badge">${escapeHtml(meal.meal_type.toUpperCase())}</span>
      </div>
      <div>
        <div class="feedback-card-recipe">${escapeHtml(meal.recipe_name || '—')}</div>
        <div class="feedback-card-sub">${currentFeedbackWeek}. Hafta • ${escapeHtml(meal.meal_label)} Menüsü</div>
      </div>
      <div class="feedback-btn-group" id="fbg-${meal.recipe_id}">
        ${buildFeedbackBtn('az',    '😐', 'Az Yenildi', meal.recipe_id, meal.current_feedback)}
        ${buildFeedbackBtn('normal','😊', 'Normal',     meal.recipe_id, meal.current_feedback)}
        ${buildFeedbackBtn('cok',   '🤩', 'Çok Sevdi',  meal.recipe_id, meal.current_feedback)}
      </div>
      ${warningHtml}
    `;

    grid.appendChild(card);
  });

  // Tüm feedback butonlarına tıklama olayı ekle
  grid.querySelectorAll('.feedback-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level    = btn.getAttribute('data-level');
      const recipeId = parseInt(btn.getAttribute('data-recipe'), 10);
      submitFeedback(recipeId, level);
    });
  });
}

function buildFeedbackBtn(level, emoji, label, recipeId, currentFeedback) {
  const isSelected = currentFeedback === level;
  const selectedClass = isSelected ? ` selected-${level}` : '';
  const checkIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  return `
    <button
      class="feedback-btn${selectedClass}"
      data-level="${level}"
      data-recipe="${recipeId}"
      id="fb-${recipeId}-${level}"
      title="${label}"
    >
      <div class="feedback-selected-badge">${checkIcon}</div>
      <span class="feedback-btn-emoji">${emoji}</span>
      <span class="feedback-btn-label">${label}</span>
    </button>
  `;
}

async function submitFeedback(recipeId, level) {
  try {
    const payload = {
      recipe_id: recipeId,
      feedback_level: level
    };
    if (currentFeedbackDate) {
      payload.date = currentFeedbackDate;
    }

    const res = await fetch(`${API_BASE_URL}/api/meal-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      showFeedbackToast(`Hata: ${data.error || 'Kaydedilemedi'}`, true);
      return;
    }

    // Buton grubundaki seçimi güncelle
    const group = document.getElementById(`fbg-${recipeId}`);
    if (group) {
      group.querySelectorAll('.feedback-btn').forEach(btn => {
        const btnLevel = btn.getAttribute('data-level');
        ['az', 'normal', 'cok'].forEach(l => btn.classList.remove(`selected-${l}`));
        if (btnLevel === level) btn.classList.add(`selected-${level}`);
      });
    }

    const labelMap = { az: 'Az Yenildi', normal: 'Normal', cok: 'Çok Sevdi' };
    showFeedbackToast(`✓ ${data.data?.recipe_name || 'Yemek'} → ${labelMap[level] || level} (${data.data?.feedback_date || ''})`);

  } catch (err) {
    console.error('[Feedback gönderme hatası]', err);
    showFeedbackToast('Bağlantı hatası', true);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AYLIK YEMEK LİSTESİ TABLOSU (PDF GÖRÜNÜMÜ)
// ─────────────────────────────────────────────────────────────────────────────

let cachedMonthlyMenu = null;
let currentMonthlyWeek = 1;

const DAYS_META = [
  { day: 1, name: 'Pazartesi' },
  { day: 2, name: 'Salı' },
  { day: 3, name: 'Çarşamba' },
  { day: 4, name: 'Perşembe' },
  { day: 5, name: 'Cuma' }
];

async function loadMonthlyMenu() {
  const tbody = document.getElementById('monthly-table-body');
  if (!tbody) return;

  if (!cachedMonthlyMenu) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">Menü yükleniyor...</td></tr>`;
    try {
      const res = await fetch(`${API_BASE_URL}/api/meal-feedback/monthly-overview`);
      const data = await res.json();
      if (data.success) {
        cachedMonthlyMenu = data.weeks;
      }
    } catch (e) {
      console.error('[Aylık Menü Yükleme Hatası]', e);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#f87171; padding:20px;">Menü yüklenemedi.</td></tr>`;
      return;
    }
  }

  showMonthlyWeek(currentMonthlyWeek);
}

function showMonthlyWeek(weekNum) {
  currentMonthlyWeek = weekNum;
  document.querySelectorAll('#monthly-week-tabs .menu-tab-btn').forEach(btn => {
    const w = parseInt(btn.getAttribute('data-w'), 10);
    btn.classList.toggle('active', w === weekNum);
  });

  const tbody = document.getElementById('monthly-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const weekData = (cachedMonthlyMenu && cachedMonthlyMenu[weekNum]) || {};

  DAYS_META.forEach(dm => {
    const d = dm.day;
    const dayMeals = weekData[d] || {};
    const kahvalti = dayMeals.kahvalti?.recipe_name || '—';
    const ogle     = dayMeals.ogle?.recipe_name || '—';
    const ikindi   = dayMeals.ikindi?.recipe_name || '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="menu-day-name">${dm.name}</div>
        <div class="menu-day-sub">${weekNum}. Hafta</div>
      </td>
      <td>
        <div class="menu-meal-cell meal-cell-kahvalti">${escapeHtml(kahvalti)}</div>
      </td>
      <td>
        <div class="menu-meal-cell meal-cell-ogle">${escapeHtml(ogle)}</div>
      </td>
      <td>
        <div class="menu-meal-cell meal-cell-ikindi">${escapeHtml(ikindi)}</div>
      </td>
      <td class="text-center">
        <button type="button" class="btn-eval-day" onclick="jumpToEvaluation(${weekNum}, ${d})">
          🎯 Değerlendir
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function jumpToEvaluation(week, day) {
  switchTab('feedback');
  selectFeedbackWeek(week);
  selectFeedbackDay(day);
}

let toastTimer = null;
function showFeedbackToast(text, isError = false) {
  const toast = document.getElementById('feedback-toast');
  const toastText = document.getElementById('feedback-toast-text');
  if (!toast) return;

  if (toastText) toastText.textContent = text;

  // Hata durumunda kırmızı renk
  toast.style.borderColor = isError ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)';
  toast.style.color       = isError ? '#f87171' : '#34d399';

  toast.classList.remove('hidden');
  // Bir tick bekleyip animasyonu başlat
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 2800);
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI FONKSİYONLAR
// ─────────────────────────────────────────────────────────────────────────────

function setLoading(isLoading) {
  const btn = document.getElementById('apply-btn');
  const spinner = document.getElementById('btn-spinner');
  const icon = document.getElementById('btn-icon');
  const text = document.getElementById('btn-text');

  if (!btn) return;

  btn.disabled = isLoading;
  if (isLoading) {
    spinner?.classList.remove('hidden');
    icon?.classList.add('hidden');
    if (text) text.textContent = 'Hesaplanıyor ve Düşülüyor...';
  } else {
    spinner?.classList.add('hidden');
    icon?.classList.remove('hidden');
    if (text) text.textContent = 'Uygula ve Stoktan Düş';
  }
}

function showAlert(title, message, type = 'error') {
  const alertBox   = document.getElementById('alert-box');
  const alertTitle = document.getElementById('alert-title');
  const alertMsg   = document.getElementById('alert-message');
  const alertIcon  = document.getElementById('alert-icon');

  if (!alertBox) return;

  alertBox.className = `alert alert-${type}`;
  if (alertTitle) alertTitle.textContent = title;
  if (alertMsg)   alertMsg.textContent = message;

  if (alertIcon) {
    alertIcon.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `;
  }

  alertBox.classList.remove('hidden');
}

function hideAlert() {
  const alertBox = document.getElementById('alert-box');
  alertBox?.classList.add('hidden');
}

function hideResults() {
  const resultSection = document.getElementById('result-section');
  resultSection?.classList.add('hidden');
}

function formatNumber(num) {
  if (num == null || isNaN(num)) return '0';
  const val = Number(num);
  if (val === 0) return '0';
  // Tam sayı → olduğu gibi yaz
  if (Number.isInteger(val)) return val.toString();
  const abs = Math.abs(val);
  // Büyük sayılar: 2 ondalık yeterli
  if (abs >= 1)    return val.toFixed(2).replace(/\.?0+$/, '');
  // 0.01 – 1 arası: 3 ondalık
  if (abs >= 0.01) return val.toFixed(3).replace(/\.?0+$/, '');
  // 0.001 – 0.01 arası: 4 ondalık
  if (abs >= 0.001) return val.toFixed(4).replace(/\.?0+$/, '');
  // Çok küçük: anlamlı rakamı göster (toPrecision ile)
  return parseFloat(val.toPrecision(3)).toString();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// YÖNETİM PANELİ
// ─────────────────────────────────────────────────────────────────────────────

// Önce ürünleri önbellekte tut (reçete formundaki dropdown için)
let _cachedProducts = [];

async function loadManagePanel() {
  await Promise.all([loadProducts(), loadRecipes()]);
}

// ── ÜRÜNLER ──────────────────────────────────────────────────────────────────

async function loadProducts() {
  const loadingEl = document.getElementById('products-loading');
  const wrapperEl = document.getElementById('products-table-wrapper');
  const tbody     = document.getElementById('products-tbody');
  if (!tbody) return;

  loadingEl?.classList.remove('hidden');
  wrapperEl?.classList.add('hidden');

  try {
    const res  = await fetch(`${API_BASE_URL}/api/products`);
    const data = await res.json();
    _cachedProducts = data.data || [];

    tbody.innerHTML = '';
    _cachedProducts.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="item-name">${escapeHtml(p.name)}</span></td>
        <td>${escapeHtml(p.unit)}</td>
        <td>${p.category ? `<span class="cat-badge">${escapeHtml(p.category)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td class="text-right">${p.critical_threshold ?? '—'}</td>
        <td class="text-right">${p.protein_per_unit != null ? p.protein_per_unit + ' g' : '—'}</td>
        <td class="text-center">
          <button class="btn-delete" title="Sil" onclick="deleteProduct(${p.id}, '${escapeHtml(p.name)}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14H6L5 6"></path>
              <path d="M10 11v6M14 11v6"></path>
              <path d="M9 6V4h6v2"></path>
            </svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    loadingEl?.classList.add('hidden');
    wrapperEl?.classList.remove('hidden');
  } catch (err) {
    console.error('[loadProducts HATA]', err);
    if (loadingEl) loadingEl.innerHTML = '<span style="color:#f87171">Yüklenemedi.</span>';
  }
}

function toggleProductForm() {
  const form = document.getElementById('product-form-container');
  const btn  = document.getElementById('product-form-toggle-btn');
  const isHidden = form?.classList.toggle('hidden');
  if (btn) btn.textContent = isHidden ? '+ Yeni Ürün Ekle' : '✕ Kapat';
  if (!isHidden) {
    document.getElementById('pf-name')?.focus();
    document.getElementById('product-form-alert')?.classList.add('hidden');
  }
}

async function saveProduct() {
  const name      = document.getElementById('pf-name')?.value.trim();
  const unit      = document.getElementById('pf-unit')?.value;
  const category  = document.getElementById('pf-category')?.value || null;
  const threshold = document.getElementById('pf-threshold')?.value;
  const protein   = document.getElementById('pf-protein')?.value;
  const alertEl   = document.getElementById('product-form-alert');
  const saveBtn   = document.getElementById('product-save-btn');
  const spinner   = document.getElementById('product-save-spinner');

  if (!name) {
    showManageAlert(alertEl, 'Ürün adı zorunludur.', 'err');
    return;
  }

  saveBtn.disabled = true;
  spinner?.classList.remove('hidden');

  try {
    const body = { name, unit, category };
    if (threshold) body.critical_threshold = parseFloat(threshold);
    if (protein)   body.protein_per_unit   = parseFloat(protein);

    const res  = await fetch(`${API_BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      showManageAlert(alertEl, data.error || 'Kaydedilemedi.', 'err');
      return;
    }

    showManageAlert(alertEl, `"${name}" ürünü eklendi!`, 'ok');
    // Formu sıfırla
    ['pf-name','pf-threshold','pf-protein'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('pf-category').value = '';
    // Listeyi yenile
    await loadProducts();
    // Dropdown'ı da güncelle
    rebuildProductDropdowns();

    setTimeout(() => toggleProductForm(), 1200);
  } catch (err) {
    showManageAlert(alertEl, 'Bağlantı hatası.', 'err');
  } finally {
    saveBtn.disabled = false;
    spinner?.classList.add('hidden');
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`"${name}" ürününü silmek istediğinize emin misiniz?\n(Stok hareketi veya reçete bağlantısı varsa engellenecektir.)`)) return;

  try {
    const res  = await fetch(`${API_BASE_URL}/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      alert(`Silinemedi: ${data.error}`);
      return;
    }
    await loadProducts();
  } catch (err) {
    alert('Bağlantı hatası.');
  }
}

// ── REÇETELER ────────────────────────────────────────────────────────────────

async function loadRecipes() {
  const loadingEl = document.getElementById('recipes-loading');
  const areaEl    = document.getElementById('recipes-cards-area');
  if (!areaEl) return;

  loadingEl?.classList.remove('hidden');
  areaEl.classList.add('hidden');

  try {
    const res  = await fetch(`${API_BASE_URL}/api/recipes`);
    const data = await res.json();
    const list = data.data || [];

    areaEl.innerHTML = '';

    const MEAL_ICONS = { kahvalti: '🌅', ogle: '🍲', ikindi: '🍪' };
    const MEAL_LABELS = { kahvalti: 'Kahvaltı', ogle: 'Öğle', ikindi: 'İkindi' };
    const MEAL_COLORS = { kahvalti: '#f59e0b', ogle: '#10b981', ikindi: '#a855f7' };

    list.forEach((recipe, idx) => {
      const card = document.createElement('div');
      card.className = 'recipe-list-card';
      card.style.animationDelay = `${idx * 0.04}s`;
      card.id = `rcard-${recipe.id}`;

      const ingChips = (recipe.ingredients || []).map(ing =>
        `<span class="recipe-ing-chip">${escapeHtml(ing.product_name)} <span>${formatNumber(ing.quantity_per_portion)} ${escapeHtml(ing.unit)}</span></span>`
      ).join('');

      const icon  = MEAL_ICONS[recipe.meal_type] || '🍽️';
      const label = MEAL_LABELS[recipe.meal_type] || recipe.meal_type;

      // Taslak kart görsel sönümlemesi
      if (recipe.is_draft) card.style.opacity = '0.72';

      // Taslak rozeti
      const draftBadge = recipe.is_draft
        ? `<span class="draft-badge">📝 Taslak</span>`
        : '';

      card.innerHTML = `
        <div class="recipe-list-card-header" onclick="toggleRecipeCard('rcard-${recipe.id}')">
          <div class="recipe-list-left">
            <span class="meal-type-pill pill-${recipe.meal_type}" style="font-size:0.7rem">${icon} ${label}</span>
            <div>
              <div class="recipe-list-name">${escapeHtml(recipe.meal_name)} ${draftBadge}</div>
              <div class="recipe-list-meta">${(recipe.ingredients||[]).length} malzeme${recipe.is_draft ? ' • Menüye eklenmedi' : ''}</div>
            </div>
          </div>
          <div class="recipe-list-right">
            <button class="btn-delete" title="Reçeteyi Sil" onclick="event.stopPropagation(); deleteRecipe(${recipe.id}, '${escapeHtml(recipe.meal_name)}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14H6L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4h6v2"></path>
              </svg>
            </button>
            <svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
        <div class="recipe-list-body">
          <div class="recipe-ing-chips">${ingChips || '<span style="color:var(--text-muted);font-size:0.82rem">Malzeme yok</span>'}</div>
        </div>
      `;
      areaEl.appendChild(card);
    });

    loadingEl?.classList.add('hidden');
    areaEl.classList.remove('hidden');
  } catch (err) {
    console.error('[loadRecipes HATA]', err);
    if (loadingEl) loadingEl.innerHTML = '<span style="color:#f87171">Yüklenemedi.</span>';
  }
}

function toggleRecipeCard(cardId) {
  document.getElementById(cardId)?.classList.toggle('expanded');
}

function toggleRecipeForm() {
  const form = document.getElementById('recipe-form-container');
  const btn  = document.getElementById('recipe-form-toggle-btn');
  const isHidden = form?.classList.toggle('hidden');
  if (btn) btn.textContent = isHidden ? '+ Yeni Reçete Ekle' : '✕ Kapat';
  if (!isHidden) {
    // İlk satırı otomatik ekle
    const list = document.getElementById('recipe-ingredients-list');
    if (list && list.children.length === 0) addIngredientRow();
    document.getElementById('rf-name')?.focus();
    document.getElementById('recipe-form-alert')?.classList.add('hidden');
  }
}

let _ingRowCounter = 0;

function addIngredientRow() {
  const list = document.getElementById('recipe-ingredients-list');
  if (!list) return;

  _ingRowCounter++;
  const rowId = `ing-row-${_ingRowCounter}`;

  // Ürün seçenekleri
  const productOptions = _cachedProducts.map(p =>
    `<option value="${p.id}">${escapeHtml(p.name)} (${p.unit})</option>`
  ).join('');

  const row = document.createElement('div');
  row.className = 'ing-row';
  row.id = rowId;
  row.innerHTML = `
    <select class="mf-input mf-select ing-product" data-row="${rowId}">
      <option value="">— Ürün seçin —</option>
      ${productOptions}
    </select>
    <input type="number" class="mf-input ing-qty" placeholder="Miktar" min="0.0001" step="0.001" data-row="${rowId}">
    <span class="mf-input" style="display:flex;align-items:center;font-size:0.78rem;color:var(--text-muted);padding:0 10px;" id="ing-unit-${rowId}">birim</span>
    <button type="button" class="btn-remove-row" onclick="removeIngredientRow('${rowId}')" title="Kaldır">×</button>
  `;

  // Ürün değişince birimi güncelle
  row.querySelector('.ing-product').addEventListener('change', function() {
    const pid   = parseInt(this.value, 10);
    const prod  = _cachedProducts.find(p => p.id === pid);
    const unitEl = document.getElementById(`ing-unit-${rowId}`);
    if (unitEl) unitEl.textContent = prod?.unit || 'birim';
  });

  list.appendChild(row);
}

function removeIngredientRow(rowId) {
  document.getElementById(rowId)?.remove();
}

function rebuildProductDropdowns() {
  // Mevcut tüm satırlardaki ürün dropdown'larını güncelle
  document.querySelectorAll('.ing-product').forEach(sel => {
    const currentVal = sel.value;
    const opts = _cachedProducts.map(p =>
      `<option value="${p.id}" ${p.id == currentVal ? 'selected' : ''}>${escapeHtml(p.name)} (${p.unit})</option>`
    ).join('');
    sel.innerHTML = `<option value="">— Ürün seçin —</option>${opts}`;
  });
}

async function saveRecipe() {
  const name     = document.getElementById('rf-name')?.value.trim();
  const mealType = document.getElementById('rf-mealtype')?.value;
  const isDraft  = document.getElementById('rf-is-draft')?.checked ?? false;
  const alertEl  = document.getElementById('recipe-form-alert');
  const saveBtn  = document.getElementById('recipe-save-btn');
  const spinner  = document.getElementById('recipe-save-spinner');

  if (!name) { showManageAlert(alertEl, 'Yemek adı zorunludur.', 'err'); return; }

  // İçerik satırlarını topla
  const rows = document.querySelectorAll('#recipe-ingredients-list .ing-row');
  const ingredients = [];

  for (const row of rows) {
    const productId = row.querySelector('.ing-product')?.value;
    const qty       = row.querySelector('.ing-qty')?.value;
    if (!productId || !qty) {
      showManageAlert(alertEl, 'Tüm satırlarda ürün ve miktar seçilmelidir.', 'err');
      return;
    }
    if (parseFloat(qty) <= 0) {
      showManageAlert(alertEl, 'Miktar sıfırdan büyük olmalıdır.', 'err');
      return;
    }
    ingredients.push({ product_id: parseInt(productId,10), quantity_per_portion: parseFloat(qty) });
  }

  if (ingredients.length === 0) {
    showManageAlert(alertEl, 'En az 1 malzeme ekleyin.', 'err');
    return;
  }

  saveBtn.disabled = true;
  spinner?.classList.remove('hidden');

  try {
    const res  = await fetch(`${API_BASE_URL}/api/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_name: name, meal_type: mealType, is_draft: isDraft, ingredients })
    });
    const data = await res.json();

    if (!res.ok) {
      showManageAlert(alertEl, data.error || 'Kaydedilemedi.', 'err');
      return;
    }

    showManageAlert(alertEl, `"${name}" reçetesi ${ingredients.length} malzemeyle eklendi!`, 'ok');
    document.getElementById('rf-name').value = '';
    document.getElementById('recipe-ingredients-list').innerHTML = '';
    _ingRowCounter = 0;
    await loadRecipes();
    setTimeout(() => toggleRecipeForm(), 1400);
  } catch (err) {
    showManageAlert(alertEl, 'Bağlantı hatası.', 'err');
  } finally {
    saveBtn.disabled = false;
    spinner?.classList.add('hidden');
  }
}

async function deleteRecipe(id, name) {
  if (!confirm(`"${name}" reçetesini silmek istediğinize emin misiniz?\n(Bağlı meal_plan kaydı varsa engellenecektir.)`)) return;

  try {
    const res  = await fetch(`${API_BASE_URL}/api/recipes/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { alert(`Silinemedi: ${data.error}`); return; }
    await loadRecipes();
  } catch (err) {
    alert('Bağlantı hatası.');
  }
}

// ── Yönetim Formu Uyarı Kutusu ───────────────────────────────────────────────

function showManageAlert(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = `manage-alert alert-${type}`;
  el.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────────────────────
// SİSTEM & OKUL AYARLARI (Hedef Yaş Grubu vb.)
// ─────────────────────────────────────────────────────────────────────────────

let currentSettings = {
  target_age_group: '2-6 Yaş Grubu',
  school_name: 'Anaokulu'
};

async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/settings`);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.settings) {
      currentSettings = { ...currentSettings, ...data.settings };
      applySettingsToUI();
    }
  } catch (err) {
    console.warn('[Ayarlar yüklenemedi, varsayılanlar kullanılıyor]', err);
    applySettingsToUI();
  }
}

function applySettingsToUI() {
  const ageGroup = currentSettings.target_age_group || '2-6 Yaş Grubu';

  // Tüm .setting-age-group elemanlarını güncelle
  document.querySelectorAll('.setting-age-group').forEach(el => {
    el.textContent = ageGroup;
  });

  // Yönetim sekmesindeki input alanını güncelle
  const inputEl = document.getElementById('setting-age-input');
  if (inputEl && document.activeElement !== inputEl) {
    inputEl.value = ageGroup;
  }
}

function setAgePreset(val) {
  const inputEl = document.getElementById('setting-age-input');
  if (inputEl) {
    inputEl.value = val;
    inputEl.focus();
  }
}

async function saveAgeSetting() {
  const inputEl = document.getElementById('setting-age-input');
  const btn = document.getElementById('save-setting-btn');
  if (!inputEl) return;

  const newAgeGroup = inputEl.value.trim();
  if (!newAgeGroup) {
    alert('Lütfen geçerli bir yaş grubu girin (Örn: 2-6 Yaş Grubu).');
    return;
  }

  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          target_age_group: newAgeGroup
        }
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kaydetme başarısız');

    currentSettings.target_age_group = newAgeGroup;
    applySettingsToUI();

    // Feedback banner varsa güncelle
    const bannerText = document.getElementById('fb-active-day-banner');
    if (bannerText && bannerText.textContent.includes('Yaş')) {
      bannerText.textContent = bannerText.textContent.replace(/• [^•]*Yaş[^•]*$/i, `• ${newAgeGroup}`);
    }

    if (btn) {
      btn.textContent = '✅ Kaydedildi!';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 1500);
    }
  } catch (err) {
    console.error('[Ayar kaydetme hatası]', err);
    alert('Ayar kaydedilirken bir hata oluştu: ' + err.message);
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
}

