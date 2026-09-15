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
    consumption:  'panel-consumption',
    feedback:     'panel-feedback',
    menu:         'panel-menu',
    manage:       'panel-manage',
    menuupload:   'panel-menuupload',
    analysis:     'panel-analysis'
  };
  const tabs = {
    consumption:  'tab-consumption',
    feedback:     'tab-feedback',
    menu:         'tab-menu',
    manage:       'tab-manage',
    menuupload:   'tab-menuupload',
    analysis:     'tab-analysis'
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

  if (tabName === 'feedback')   loadFeedbackMeals();
  if (tabName === 'menu')       loadMonthlyMenu(true);
  if (tabName === 'manage')     loadManagePanel();
  if (tabName === 'analysis')   loadAnalysisPanel();
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

  // Maliyet ve Uyarı Gösterimi
  const costVal    = document.getElementById('stat-cost-value');
  const costBanner = document.getElementById('cost-summary-banner');
  const costText   = document.getElementById('cost-summary-text');
  const costWarn   = document.getElementById('cost-missing-warning');

  const totalCost = data.total_cost || 0;
  if (costVal) {
    costVal.textContent = `₺${Number(totalCost).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (costBanner) {
    if (data.cost_summary) {
      costBanner.classList.remove('hidden');
      if (costText) costText.textContent = data.cost_summary;
      if (costWarn) {
        if (data.missing_price_warning) {
          costWarn.textContent = `⚠️ ${data.missing_price_warning}`;
          costWarn.classList.remove('hidden');
        } else {
          costWarn.classList.add('hidden');
        }
      }
    } else {
      costBanner.classList.add('hidden');
    }
  }

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

async function loadMonthlyMenu(force = false) {
  const tbody = document.getElementById('monthly-table-body');
  if (!tbody) return;

  if (!cachedMonthlyMenu || force) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);"><div class="loading-spinner-lg" style="margin:0 auto 10px;"></div>Menü yükleniyor...</td></tr>`;
    try {
      const res = await fetch(`${API_BASE_URL}/api/meal-feedback/monthly-overview?t=${Date.now()}`);
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
    const dateStr  = dayMeals.kahvalti?.date || dayMeals.ogle?.date || dayMeals.ikindi?.date;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="menu-day-name">${dm.name}</div>
        <div class="menu-day-sub">${dateStr ? dateStr : `${weekNum}. Hafta`}</div>
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
let _editingProductId = null;

function getProductStockQty(p) {
  if (p.stock_quantity != null) return parseFloat(p.stock_quantity);
  if (typeof p.current_stock === 'number') return p.current_stock;
  if (p.current_stock && typeof p.current_stock === 'object') {
    if (Array.isArray(p.current_stock)) {
      return p.current_stock[0]?.quantity != null ? parseFloat(p.current_stock[0].quantity) : 0;
    }
    return p.current_stock.quantity != null ? parseFloat(p.current_stock.quantity) : 0;
  }
  return 0;
}

function formatStockQuantity(val) {
  if (val == null || isNaN(val) || val === '') return '0';
  const num = parseFloat(val);
  return Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(2)).toString();
}

function getProductRiskScore(p) {
  const stockQty = getProductStockQty(p);
  const thresh = (p.critical_threshold != null && p.critical_threshold !== '') ? parseFloat(p.critical_threshold) : null;

  if (thresh != null) {
    if (thresh > 0) {
      return {
        ratio: stockQty / thresh,
        diff: stockQty - thresh,
        isCritical: stockQty <= thresh,
        hasThresh: true
      };
    } else {
      return {
        ratio: stockQty <= 0 ? 0 : Infinity,
        diff: stockQty,
        isCritical: stockQty <= 0,
        hasThresh: true
      };
    }
  }
  return {
    ratio: Infinity,
    diff: Infinity,
    isCritical: false,
    hasThresh: false
  };
}

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

    // Stoğu kritik eşiğine en yakın olan (yani en riskli) ürünler en üstte olacak şekilde sırala
    const sortedProducts = [..._cachedProducts].sort((a, b) => {
      const scoreA = getProductRiskScore(a);
      const scoreB = getProductRiskScore(b);

      if (scoreA.ratio !== scoreB.ratio) {
        return scoreA.ratio - scoreB.ratio;
      }
      if (scoreA.diff !== scoreB.diff) {
        return scoreA.diff - scoreB.diff;
      }
      return (a.name || '').localeCompare(b.name || '', 'tr');
    });

    tbody.innerHTML = '';
    sortedProducts.forEach(p => {
      const stockQty   = getProductStockQty(p);
      const thresh     = (p.critical_threshold != null && p.critical_threshold !== '') ? parseFloat(p.critical_threshold) : null;
      const isCritical = thresh != null ? (stockQty <= thresh) : false;

      const formattedStock = `${formatStockQuantity(stockQty)} ${escapeHtml(p.unit || '')}`;
      const statusBadge = isCritical
        ? `<span class="badge badge-danger"><span class="badge-dot"></span>Kritik</span>`
        : `<span class="badge badge-success"><span class="badge-dot"></span>Normal</span>`;

      const tr = document.createElement('tr');
      if (isCritical) {
        tr.classList.add('row-critical');
      }
      tr.innerHTML = `
        <td><span class="item-name">${escapeHtml(p.name)}</span></td>
        <td>${escapeHtml(p.unit || '—')}</td>
        <td>${p.category ? `<span class="cat-badge">${escapeHtml(p.category)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td class="text-right">${p.critical_threshold != null ? `${formatStockQuantity(p.critical_threshold)} ${escapeHtml(p.unit || '')}` : '—'}</td>
        <td class="text-right font-medium"><span class="${isCritical ? 'text-danger' : ''}">${formattedStock}</span></td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center actions-cell">
          <div style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">
            <button class="btn-edit" title="Düzenle" onclick="editProduct(${p.id})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-delete" title="Sil" onclick="deleteProduct(${p.id}, '${escapeHtml(p.name)}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14H6L5 6"></path>
                <path d="M10 11v6M14 11v6"></path>
                <path d="M9 6V4h6v2"></path>
              </svg>
            </button>
          </div>
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

function toggleProductForm(forceClose = false) {
  const form = document.getElementById('product-form-container');
  const btn  = document.getElementById('product-form-toggle-btn');
  const titleEl = document.getElementById('product-form-title') || form?.querySelector('.manage-form-title');
  const saveBtn = document.getElementById('product-save-btn');

  let isHidden;
  if (forceClose) {
    form?.classList.add('hidden');
    isHidden = true;
  } else {
    isHidden = form?.classList.toggle('hidden');
  }

  if (btn) {
    btn.innerHTML = isHidden
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Yeni Ürün Ekle`
      : '✕ Kapat';
  }

  if (isHidden) {
    _editingProductId = null;
    if (titleEl) titleEl.textContent = 'Yeni Ürün';
    if (saveBtn) saveBtn.innerHTML = '<span id="product-save-spinner" class="btn-spinner hidden"></span>Kaydet';
  } else {
    if (!_editingProductId) {
      if (titleEl) titleEl.textContent = 'Yeni Ürün';
      if (saveBtn) saveBtn.innerHTML = '<span id="product-save-spinner" class="btn-spinner hidden"></span>Kaydet';
      ['pf-name','pf-threshold','pf-protein'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const catEl = document.getElementById('pf-category');
      if (catEl) catEl.value = '';
      const unitEl = document.getElementById('pf-unit');
      if (unitEl) unitEl.value = 'kg';
      document.getElementById('pf-name')?.focus();
      document.getElementById('product-form-alert')?.classList.add('hidden');
    }
  }
}

function editProduct(productId) {
  const p = _cachedProducts.find(item => item.id === productId);
  if (!p) return;

  const modal     = document.getElementById('product-edit-modal');
  const titleEl   = document.getElementById('pmodal-title');
  const idEl      = document.getElementById('pmodal-id');
  const nameEl    = document.getElementById('pmodal-name');
  const unitEl    = document.getElementById('pmodal-unit');
  const catEl     = document.getElementById('pmodal-category');
  const priceEl   = document.getElementById('pmodal-price');
  const threshEl  = document.getElementById('pmodal-threshold');
  const proteinEl = document.getElementById('pmodal-protein');
  const alertEl   = document.getElementById('pmodal-alert');
  const saveBtn   = document.getElementById('pmodal-save-btn');

  if (modal) {
    if (titleEl)   titleEl.textContent = `Ürünü Düzenle: ${p.name}`;
    if (idEl)      idEl.value = p.id;
    if (nameEl)    nameEl.value = p.name || '';
    if (priceEl)   priceEl.value = (p.unit_price != null && p.unit_price !== '') ? p.unit_price : '';
    if (threshEl)  threshEl.value = (p.critical_threshold != null && p.critical_threshold !== '') ? p.critical_threshold : '';
    if (proteinEl) proteinEl.value = (p.protein_per_unit != null && p.protein_per_unit !== '') ? p.protein_per_unit : '';
    if (alertEl)   alertEl.classList.add('hidden');
    if (saveBtn)   saveBtn.disabled = false;

    // Birim
    if (unitEl) {
      const unitVal = p.unit || 'kg';
      let exists = false;
      for (let i = 0; i < unitEl.options.length; i++) {
        if (unitEl.options[i].value === unitVal) {
          exists = true;
          break;
        }
      }
      if (!exists && unitVal) {
        const opt = document.createElement('option');
        opt.value = unitVal;
        opt.textContent = unitVal;
        unitEl.appendChild(opt);
      }
      unitEl.value = unitVal;
    }

    // Kategori
    if (catEl) {
      const catVal = p.category || '';
      let exists = false;
      for (let i = 0; i < catEl.options.length; i++) {
        if (catEl.options[i].value === catVal) {
          exists = true;
          break;
        }
      }
      if (!exists && catVal) {
        const opt = document.createElement('option');
        opt.value = catVal;
        opt.textContent = catVal.charAt(0).toUpperCase() + catVal.slice(1);
        catEl.appendChild(opt);
      }
      catEl.value = catVal;
    }

    modal.classList.remove('hidden');
    setTimeout(() => nameEl?.focus(), 50);
    return;
  }

  // Fallback (eğer modal yoksa üst form)
  _editingProductId = productId;
  const formBox   = document.getElementById('product-form-container');
  const toggleBtn = document.getElementById('product-form-toggle-btn');
  const fTitle    = document.getElementById('product-form-title') || formBox?.querySelector('.manage-form-title');
  const fSaveBtn  = document.getElementById('product-save-btn');
  const fAlert    = document.getElementById('product-form-alert');

  formBox?.classList.remove('hidden');
  if (toggleBtn) toggleBtn.textContent = '✕ İptal';
  if (fTitle)    fTitle.textContent = `Ürünü Düzenle: ${p.name}`;
  if (fSaveBtn)  fSaveBtn.innerHTML = '<span id="product-save-spinner" class="btn-spinner hidden"></span>Değişiklikleri Kaydet';
  if (fAlert)    fAlert.classList.add('hidden');

  const pfName = document.getElementById('pf-name');
  if (pfName) pfName.value = p.name || '';
  formBox?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeProductEditModal() {
  const modal = document.getElementById('product-edit-modal');
  modal?.classList.add('hidden');
}

async function saveProductModal() {
  const idEl      = document.getElementById('pmodal-id');
  const nameEl    = document.getElementById('pmodal-name');
  const unitEl    = document.getElementById('pmodal-unit');
  const catEl     = document.getElementById('pmodal-category');
  const priceEl   = document.getElementById('pmodal-price');
  const threshEl  = document.getElementById('pmodal-threshold');
  const proteinEl = document.getElementById('pmodal-protein');
  const alertEl   = document.getElementById('pmodal-alert');
  const saveBtn   = document.getElementById('pmodal-save-btn');
  const spinner   = document.getElementById('pmodal-save-spinner');

  const id        = idEl?.value;
  const name      = nameEl?.value.trim();
  const unit      = unitEl?.value;
  const category  = catEl?.value || null;
  const price     = priceEl?.value;
  const threshold = threshEl?.value;
  const protein   = proteinEl?.value;

  if (!id) return;
  if (!name) {
    showManageAlert(alertEl, 'Ürün adı zorunludur.', 'err');
    nameEl?.focus();
    return;
  }
  if (!unit) {
    showManageAlert(alertEl, 'Birim alanı zorunludur.', 'err');
    unitEl?.focus();
    return;
  }

  saveBtn.disabled = true;
  spinner?.classList.remove('hidden');

  try {
    const body = {
      name,
      unit,
      category,
      unit_price: (price !== '' && price != null) ? parseFloat(price) : null,
      critical_threshold: (threshold !== '' && threshold != null) ? parseFloat(threshold) : null,
      protein_per_unit: (protein !== '' && protein != null) ? parseFloat(protein) : null
    };

    const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      showManageAlert(alertEl, data.error || 'Güncellenemedi.', 'err');
      return;
    }

    showManageAlert(alertEl, `"${name}" başarıyla güncellendi!`, 'ok');

    // Listeyi hemen yenile
    await loadProducts();
    rebuildProductDropdowns();

    setTimeout(() => {
      closeProductEditModal();
    }, 600);
  } catch (err) {
    showManageAlert(alertEl, 'Bağlantı hatası.', 'err');
  } finally {
    saveBtn.disabled = false;
    spinner?.classList.add('hidden');
  }
}

// ESC tuşu ile modalı kapat
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeProductEditModal();
  }
});

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
  if (!unit) {
    showManageAlert(alertEl, 'Birim alanı zorunludur.', 'err');
    return;
  }

  saveBtn.disabled = true;
  spinner?.classList.remove('hidden');

  try {
    const body = { name, unit, category };
    body.critical_threshold = (threshold !== '' && threshold != null) ? parseFloat(threshold) : null;
    body.protein_per_unit   = (protein !== '' && protein != null) ? parseFloat(protein) : null;

    const isEdit = _editingProductId != null;
    const url    = isEdit ? `${API_BASE_URL}/api/products/${_editingProductId}` : `${API_BASE_URL}/api/products`;
    const method = isEdit ? 'PUT' : 'POST';

    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      showManageAlert(alertEl, data.error || (isEdit ? 'Güncellenemedi.' : 'Kaydedilemedi.'), 'err');
      return;
    }

    showManageAlert(alertEl, isEdit ? `"${name}" ürünü başarıyla güncellendi!` : `"${name}" ürünü eklendi!`, 'ok');

    // Listeyi hemen yenile (anında tabloda güncellensin)
    await loadProducts();
    // Dropdown'ı da güncelle
    rebuildProductDropdowns();

    setTimeout(() => {
      toggleProductForm(true);
    }, 1000);
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

let _cachedRecipes = [];
let _editingRecipeId = null;

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
    _cachedRecipes = list;

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
      const isDraftOrEmpty = recipe.is_draft || (recipe.ingredients || []).length === 0;

      // Taslak kart görsel sönümlemesi
      if (recipe.is_draft) card.style.opacity = '0.85';

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
              <div class="recipe-list-meta">${(recipe.ingredients||[]).length} malzeme${recipe.is_draft ? ' • Menüye eklendi, malzeme bekliyor' : ''}</div>
            </div>
          </div>
          <div class="recipe-list-right">
            <button class="btn-edit-recipe ${isDraftOrEmpty ? 'btn-fill-draft' : ''}" 
                    title="${isDraftOrEmpty ? 'Malzemeleri Doldur ve Yayına Al' : 'Reçeteyi Düzenle'}" 
                    onclick="event.stopPropagation(); editRecipe(${recipe.id})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>${isDraftOrEmpty ? 'Malzeme Ekle' : 'Düzenle'}</span>
            </button>
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
          <div class="recipe-ing-chips">
            ${ingChips || `
              <div style="display:flex;align-items:center;gap:10px;padding:6px 0;">
                <span style="color:var(--text-muted);font-size:0.82rem">Bu reçeteye henüz malzeme eklenmemiş.</span>
                <button class="btn-edit-recipe btn-fill-draft" onclick="editRecipe(${recipe.id})">✏️ Şimdi Malzeme Tanımla</button>
              </div>
            `}
          </div>
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
  const titleEl = form?.querySelector('.manage-form-title');
  const saveBtn = document.getElementById('recipe-save-btn');

  const isHidden = form?.classList.toggle('hidden');
  if (btn) btn.textContent = isHidden ? '+ Yeni Reçete Ekle' : '✕ Kapat';

  if (isHidden) {
    _editingRecipeId = null;
  } else {
    // Yeni reçete moduna sıfırla
    _editingRecipeId = null;
    if (titleEl) titleEl.textContent = 'Yeni Reçete';
    if (saveBtn) saveBtn.innerHTML = '<span id="recipe-save-spinner" class="btn-spinner hidden"></span>Reçeteyi Kaydet';
    document.getElementById('rf-name').value = '';
    document.getElementById('rf-mealtype').value = 'ogle';
    document.getElementById('rf-is-draft').checked = false;
    const list = document.getElementById('recipe-ingredients-list');
    if (list) list.innerHTML = '';
    _ingRowCounter = 0;
    addIngredientRow();
    document.getElementById('rf-name')?.focus();
    document.getElementById('recipe-form-alert')?.classList.add('hidden');
  }
}

function editRecipe(recipeId) {
  const recipe = _cachedRecipes.find(r => r.id === recipeId);
  if (!recipe) return;

  _editingRecipeId = recipeId;

  const formBox     = document.getElementById('recipe-form-container');
  const toggleBtn   = document.getElementById('recipe-form-toggle-btn');
  const titleEl     = formBox?.querySelector('.manage-form-title');
  const saveBtn     = document.getElementById('recipe-save-btn');
  const alertEl     = document.getElementById('recipe-form-alert');

  // Formu aç
  formBox?.classList.remove('hidden');
  if (toggleBtn) toggleBtn.textContent = '✕ İptal';
  if (titleEl) titleEl.textContent = `Reçeteyi Düzenle: ${recipe.meal_name}`;
  if (saveBtn) saveBtn.innerHTML = '<span id="recipe-save-spinner" class="btn-spinner hidden"></span>Değişiklikleri Kaydet';

  // Alanları doldur
  const nameInput     = document.getElementById('rf-name');
  const mealTypeInput = document.getElementById('rf-mealtype');
  const draftCheckbox = document.getElementById('rf-is-draft');

  if (nameInput) nameInput.value = recipe.meal_name;
  if (mealTypeInput) mealTypeInput.value = recipe.meal_type || 'ogle';
  // Taslaksa, malzeme girildiğinde otomatik yayına çıksın diye varsayılan olarak unchecked yapıyoruz (kullanıcı isterse tekrar işaretleyebilir)
  if (draftCheckbox) draftCheckbox.checked = false;

  // İçerik satırlarını doldur
  const list = document.getElementById('recipe-ingredients-list');
  if (list) list.innerHTML = '';
  _ingRowCounter = 0;

  if (recipe.ingredients && recipe.ingredients.length > 0) {
    recipe.ingredients.forEach(ing => {
      addIngredientRow(ing.product_id, ing.quantity_per_portion);
    });
  } else {
    // Malzeme yoksa kullanıcı doldursun diye 1 boş satır aç
    addIngredientRow();
  }

  alertEl?.classList.add('hidden');

  // Forma kaydır ve odaklan
  formBox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const firstQty = formBox?.querySelector('.ing-qty');
  if (firstQty) firstQty.focus();
}

let _ingRowCounter = 0;

function addIngredientRow(productId = '', quantity = '') {
  const list = document.getElementById('recipe-ingredients-list');
  if (!list) return;

  _ingRowCounter++;
  const rowId = `ing-row-${_ingRowCounter}`;

  // Ürün seçenekleri
  const productOptions = _cachedProducts.map(p =>
    `<option value="${p.id}" ${p.id == productId ? 'selected' : ''}>${escapeHtml(p.name)} (${p.unit})</option>`
  ).join('');

  const selectedProd = _cachedProducts.find(p => p.id == productId);
  const unitText = selectedProd?.unit || 'birim';

  const row = document.createElement('div');
  row.className = 'ing-row';
  row.id = rowId;
  row.innerHTML = `
    <select class="mf-input mf-select ing-product" data-row="${rowId}">
      <option value="">— Ürün seçin —</option>
      ${productOptions}
    </select>
    <input type="number" class="mf-input ing-qty" placeholder="Miktar" min="0.0001" step="0.001" value="${quantity || ''}" data-row="${rowId}">
    <span class="mf-input" style="display:flex;align-items:center;font-size:0.78rem;color:var(--text-muted);padding:0 10px;" id="ing-unit-${rowId}">${unitText}</span>
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

  const isEditing = !!_editingRecipeId;
  const url = isEditing ? `${API_BASE_URL}/api/recipes/${_editingRecipeId}` : `${API_BASE_URL}/api/recipes`;
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res  = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_name: name, meal_type: mealType, is_draft: isDraft, ingredients })
    });
    const data = await res.json();

    if (!res.ok) {
      showManageAlert(alertEl, data.error || 'Kaydedilemedi.', 'err');
      return;
    }

    const successMsg = isEditing 
      ? `"${name}" reçetesi ${ingredients.length} malzemeyle güncellendi ve yayına alındı!`
      : `"${name}" reçetesi ${ingredients.length} malzemeyle eklendi!`;

    showManageAlert(alertEl, successMsg, 'ok');
    document.getElementById('rf-name').value = '';
    document.getElementById('recipe-ingredients-list').innerHTML = '';
    _ingRowCounter = 0;
    _editingRecipeId = null;

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

// ── Sistemi Gerçek Kullanıma Hazırla ──────────────────────────────────────────
async function resetSystemForProduction() {
  const confirmed = confirm('Emin misiniz? Tüm stok geçmişi silinecek, ürün listesi kalacak');
  if (!confirmed) return;

  const btn     = document.getElementById('btn-reset-system');
  const spinner = document.getElementById('reset-system-spinner');
  const alertEl = document.getElementById('reset-system-alert');

  if (btn) btn.disabled = true;
  spinner?.classList.remove('hidden');
  if (alertEl) alertEl.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE_URL}/api/settings/reset-system`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showManageAlert(alertEl, data.error || 'Sıfırlama işlemi sırasında bir hata oluştu.', 'err');
      return;
    }

    showManageAlert(alertEl, data.message || 'Sistem gerçek kullanıma hazırlandı! Güncel stoklar sıfırlandı.', 'ok');

    // Ürün listesini hemen yeniden yükle (tüm ürünlerin stoğu 0 olarak güncellenir)
    await loadProducts();

    // Varsa öğün değerlendirme ve menü önbelleklerini tazele
    if (typeof loadFeedbackMeals === 'function') {
      try { await loadFeedbackMeals(); } catch (_) {}
    }
  } catch (err) {
    showManageAlert(alertEl, 'Bağlantı hatası: ' + err.message, 'err');
  } finally {
    if (btn) btn.disabled = false;
    spinner?.classList.add('hidden');
  }
}


// =============================================================================
// AYLIK MENÜ YÜKLEME — menu upload panel logic
// =============================================================================

let muFile = null;

// Sayfa yüklenince Ay seçiciyi bulunduğumuz aya getir
(function muInitDefaults() {
  const now = new Date();
  const monthSel = document.getElementById('mu-month');
  const yearInp  = document.getElementById('mu-year');
  if (monthSel) monthSel.value = String(now.getMonth() + 1);
  if (yearInp)  yearInp.value  = String(now.getFullYear());
})();

// ── Dropzone etkileşimleri ───────────────────────────────────────────────────
(function muInitDropzone() {
  const dropzone  = document.getElementById('mu-dropzone');
  const fileInput = document.getElementById('mu-file-input');
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      muSetFile(fileInput.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      muSetFile(e.dataTransfer.files[0]);
      const dt = new DataTransfer();
      dt.items.add(e.dataTransfer.files[0]);
      fileInput.files = dt.files;
    }
  });
})();

function muSetFile(file) {
  muFile = file;
  const filename = document.getElementById('mu-filename');
  if (filename) {
    filename.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    filename.classList.remove('hidden');
  }
  const parseBtn = document.getElementById('mu-parse-btn');
  if (parseBtn) parseBtn.disabled = false;
  const alertEl = document.getElementById('mu-parse-alert');
  if (alertEl) alertEl.classList.add('hidden');
}

// ── AI Menü Okuma ────────────────────────────────────────────────────────────
async function menuParse() {
  if (!muFile) return;

  const month = document.getElementById('mu-month')?.value;
  const year  = document.getElementById('mu-year')?.value;
  if (!month || !year) return muShowParseError('Lütfen ay ve yıl seçin.');

  const spinner  = document.getElementById('mu-parse-spinner');
  const parseBtn = document.getElementById('mu-parse-btn');
  const alertEl  = document.getElementById('mu-parse-alert');

  parseBtn.disabled = true;
  spinner.classList.remove('hidden');
  alertEl.classList.add('hidden');
  document.getElementById('mu-preview-section')?.classList.add('hidden');

  try {
    const formData = new FormData();
    formData.append('file',  muFile);
    formData.append('month', month);
    formData.append('year',  year);

    const resp = await fetch(`${API_BASE_URL}/api/menu/parse`, {
      method: 'POST',
      body:   formData
    });

    const data = await resp.json();
    if (!data.success) return muShowParseError(data.error || 'Bilinmeyen bir hata oluştu.');

    muRenderPreview(data.gunler);
  } catch (err) {
    muShowParseError(`Ağ hatası: ${err.message}`);
  } finally {
    parseBtn.disabled = false;
    spinner.classList.add('hidden');
  }
}

function muShowParseError(msg) {
  const alertEl = document.getElementById('mu-parse-alert');
  if (!alertEl) return;
  alertEl.classList.remove('hidden');
  alertEl.innerHTML = `<span style="font-size:1.1rem">⚠️</span><div><p class="alert-title">Hata</p><p class="alert-message">${msg}</p></div>`;
}

// ── Önizleme Tablosunu Doldur ────────────────────────────────────────────────
function muRenderPreview(gunler) {
  const tbody   = document.getElementById('mu-preview-tbody');
  const section = document.getElementById('mu-preview-section');
  const counter = document.getElementById('mu-gun-count');
  if (!tbody || !section) return;

  tbody.innerHTML = '';

  gunler.forEach((gun) => {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.className = 'mu-date-cell';
    tdDate.textContent = gun.tarih;
    tr.appendChild(tdDate);

    const tdDay = document.createElement('td');
    tdDay.className = 'mu-day-cell';
    tdDay.textContent = gun.gun_adi || '';
    tr.appendChild(tdDay);

    ['kahvalti', 'ogle', 'ikindi'].forEach(tip => {
      const td = document.createElement('td');
      const ta = document.createElement('textarea');
      ta.className = 'mu-editable';
      ta.dataset.tip = tip;
      ta.value = (gun[tip] || []).join('\n');
      ta.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
      });
      setTimeout(() => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      }, 0);
      td.appendChild(ta);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  if (counter) counter.textContent = `${gunler.length} gün`;
  section.classList.remove('hidden');

  const saveAlert = document.getElementById('mu-save-alert');
  if (saveAlert) { saveAlert.classList.add('hidden'); saveAlert.innerHTML = ''; }
}

// ── Temizle ──────────────────────────────────────────────────────────────────
function menuResetPreview() {
  document.getElementById('mu-preview-section')?.classList.add('hidden');
  const tbody = document.getElementById('mu-preview-tbody');
  if (tbody) tbody.innerHTML = '';
  muFile = null;
  const fileInput = document.getElementById('mu-file-input');
  if (fileInput) fileInput.value = '';
  const filename = document.getElementById('mu-filename');
  if (filename) { filename.textContent = ''; filename.classList.add('hidden'); }
  const parseBtn = document.getElementById('mu-parse-btn');
  if (parseBtn) parseBtn.disabled = true;
  document.getElementById('mu-parse-alert')?.classList.add('hidden');
  document.getElementById('mu-save-alert')?.classList.add('hidden');
}

// ── Tablodan Günleri Topla ───────────────────────────────────────────────────
function muCollectGunler() {
  const rows = document.querySelectorAll('#mu-preview-tbody tr');
  const gunler = [];
  rows.forEach(tr => {
    const tarih  = tr.querySelector('.mu-date-cell')?.textContent?.trim();
    const gunAdi = tr.querySelector('.mu-day-cell')?.textContent?.trim();
    if (!tarih) return;
    const result = { tarih, gun_adi: gunAdi };
    tr.querySelectorAll('textarea.mu-editable').forEach(ta => {
      result[ta.dataset.tip] = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
    });
    gunler.push(result);
  });
  return gunler;
}

// ── Onayla ve Kaydet ─────────────────────────────────────────────────────────
async function menuSave() {
  const gunler = muCollectGunler();
  if (gunler.length === 0) return;

  const saveBtn     = document.getElementById('mu-save-btn');
  const saveSpinner = document.getElementById('mu-save-spinner');
  const saveAlert   = document.getElementById('mu-save-alert');

  saveBtn.disabled = true;
  saveSpinner.classList.remove('hidden');
  saveAlert.classList.add('hidden');
  saveAlert.innerHTML = '';

  try {
    const resp = await fetch(`${API_BASE_URL}/api/menu/save`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ gunler })
    });
    const data = await resp.json();

    if (!data.success) {
      saveAlert.classList.remove('hidden');
      saveAlert.className = 'alert alert-error';
      saveAlert.innerHTML = `<span>❌</span><div><p class="alert-title">Kaydetme hatası</p><p class="alert-message">${data.error}</p></div>`;
      return;
    }

    cachedMonthlyMenu = null;

    const recetesizler = data.recetesiz_yemekler || [];
    let html = `<div class="mu-success-box">
      <div>✅ <strong>${data.kaydedilen}</strong> menü satırı başarıyla kaydedildi.</div>`;

    if (recetesizler.length > 0) {
      html += `<div class="mu-warn-section">
        <div class="mu-warn-section-title">⚠️ Şu yemeklerin reçetesi henüz tanımlanmamış (taslak olarak oluşturuldu):</div>
        <ul class="mu-warn-list">
          ${recetesizler.map(y => `<li>${y}</li>`).join('')}
        </ul>
        <p style="margin-top:10px;font-size:0.83rem;color:#94a3b8;">"Ürünler &amp; Reçeteler" sekmesinden malzeme ekleyebilirsiniz.</p>
      </div>`;
    }
    html += '</div>';

    saveAlert.classList.remove('hidden');
    saveAlert.className = '';
    saveAlert.innerHTML = html;
  } catch (err) {
    saveAlert.classList.remove('hidden');
    saveAlert.className = 'alert alert-error';
    saveAlert.innerHTML = `<span>❌</span><div><p class="alert-title">Ağ hatası</p><p class="alert-message">${err.message}</p></div>`;
  } finally {
    saveBtn.disabled = false;
    saveSpinner.classList.add('hidden');
  }
}

// =============================================================================
// ANALİZ & GÖSTERGE PANELİ (CHART.JS)
// =============================================================================

let _analyticsData = null;
let _analyticsRange = 12; // 6 veya 12 ay
let _analyticsMetricMode = 'tl'; // 'tl' veya 'qty'
let _analyticsSelectedMonth = null; // 'YYYY-MM'
let _analyticsSelectedProductId = null;

let _chartMonthly = null;
let _chartCategory = null;
let _chartTopProducts = null;
let _chartProductTrend = null;

const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const CATEGORY_COLORS = {
  'sebze':        { bg: 'rgba(16, 185, 129, 0.75)',  border: '#10b981' },
  'meyve':        { bg: 'rgba(245, 158, 11, 0.75)',  border: '#f59e0b' },
  'et & balık':   { bg: 'rgba(244, 63, 94, 0.75)',   border: '#f43f5e' },
  'et_balik':     { bg: 'rgba(244, 63, 94, 0.75)',   border: '#f43f5e' },
  'süt ürünleri': { bg: 'rgba(6, 182, 212, 0.75)',   border: '#06b6d4' },
  'sut_urunleri': { bg: 'rgba(6, 182, 212, 0.75)',   border: '#06b6d4' },
  'bakliyat':     { bg: 'rgba(139, 92, 246, 0.75)',  border: '#8b5cf6' },
  'tahıl':        { bg: 'rgba(234, 179, 8, 0.75)',   border: '#eab308' },
  'tahil':        { bg: 'rgba(234, 179, 8, 0.75)',   border: '#eab308' },
  'fırın':        { bg: 'rgba(217, 119, 6, 0.75)',   border: '#d97706' },
  'firin':        { bg: 'rgba(217, 119, 6, 0.75)',   border: '#d97706' },
  'kahvaltılık':  { bg: 'rgba(99, 102, 241, 0.75)',  border: '#6366f1' },
  'kahvaltilik':  { bg: 'rgba(99, 102, 241, 0.75)',  border: '#6366f1' },
  'yağ':          { bg: 'rgba(202, 138, 4, 0.75)',   border: '#ca8a04' },
  'yag':          { bg: 'rgba(202, 138, 4, 0.75)',   border: '#ca8a04' },
  'baharat':      { bg: 'rgba(236, 72, 153, 0.75)',  border: '#ec4899' },
  'çorbalık':     { bg: 'rgba(20, 184, 166, 0.75)',  border: '#14b8a6' },
  'unlu mamül':   { bg: 'rgba(249, 115, 22, 0.75)',  border: '#f97316' },
  'kuru gıda':    { bg: 'rgba(168, 85, 247, 0.75)',  border: '#a855f7' },
  'diger':        { bg: 'rgba(148, 163, 184, 0.75)', border: '#94a3b8' }
};

function getCategoryColor(cat) {
  const c = (cat || 'diger').toLowerCase().trim();
  return CATEGORY_COLORS[c] || { bg: 'rgba(59, 130, 246, 0.75)', border: '#3b82f6' };
}

function getMonthRangeKeys(n = 12) {
  const list = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const key = `${yyyy}-${mm}`;
    const label = `${AY_ADLARI[d.getMonth()]} ${yyyy}`;
    const shortLabel = `${AY_ADLARI[d.getMonth()].slice(0, 3)} '${String(yyyy).slice(2)}`;
    list.push({ key, label, shortLabel });
  }
  return list;
}

function getChartDefaultOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    color: '#94a3b8',
    plugins: {
      legend: {
        labels: {
          color: '#cbd5e1',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: '700' },
        bodyFont: { family: "'Plus Jakarta Sans', sans-serif" }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }, beginAtZero: true }
      }
    }
  };
}

async function loadAnalysisPanel() {
  if (typeof Chart === 'undefined') {
    console.warn('[Chart.js henüz yüklenmedi]');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/analytics/summary?months=12`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Analiz verisi alınamadı');

    _analyticsData = json;

    const txs   = _analyticsData.data?.transactions || [];
    const prods = _analyticsData.data?.products || [];

    // Boş durum bilgilendirmesi
    const emptyNotice = document.getElementById('analytics-empty-notice');
    if (emptyNotice) {
      if (txs.length === 0) emptyNotice.classList.remove('hidden');
      else emptyNotice.classList.add('hidden');
    }

    // Ay ve ürün dropdown'larını başlat
    initAnalysisMonthSelect(txs);
    initAnalysisProductSelect(prods, txs);

    // KPI ve Grafikleri çiz
    updateAnalysisKPIs();
    renderMonthlyConsumptionChart();
    renderCategoryDistChart();
    renderTopProductsChart();
    renderProductTrendChart();
  } catch (err) {
    console.error('[loadAnalysisPanel HATA]', err);
  }
}

function initAnalysisMonthSelect(txs) {
  const select = document.getElementById('analysis-month-select');
  if (!select) return;

  const monthRange = getMonthRangeKeys(12);

  // Veri bulunan ayları tespit et
  const activeMonths = new Set(txs.map(t => (t.transaction_date || '').slice(0, 7)));

  if (!_analyticsSelectedMonth || !monthRange.some(m => m.key === _analyticsSelectedMonth)) {
    const latestWithData = [...monthRange].reverse().find(m => activeMonths.has(m.key));
    _analyticsSelectedMonth = latestWithData ? latestWithData.key : monthRange[monthRange.length - 1].key;
  }

  select.innerHTML = monthRange.map(m => {
    const hasData = activeMonths.has(m.key);
    return `<option value="${m.key}" ${m.key === _analyticsSelectedMonth ? 'selected' : ''}>${m.label}${hasData ? ' (Kayıt Var)' : ''}</option>`;
  }).join('');
}

function initAnalysisProductSelect(prods, txs) {
  const select = document.getElementById('analysis-product-select');
  if (!select) return;

  const activeProdIds = new Set(txs.map(t => t.product_id));

  if (!_analyticsSelectedProductId && prods.length > 0) {
    const firstActive = prods.find(p => activeProdIds.has(p.id));
    _analyticsSelectedProductId = firstActive ? firstActive.id : prods[0].id;
  }

  select.innerHTML = prods.map(p => {
    const isActive = activeProdIds.has(p.id);
    const hasPrice = (p.unit_price != null && !isNaN(parseFloat(p.unit_price)) && parseFloat(p.unit_price) > 0);
    const priceTag = hasPrice ? ` — ₺${Number(p.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
    return `<option value="${p.id}" ${p.id == _analyticsSelectedProductId ? 'selected' : ''}>${escapeHtml(p.name)} (${escapeHtml(p.unit || '')}${priceTag})${isActive ? ' •' : ''}</option>`;
  }).join('');
}

function updateAnalysisKPIs() {
  const txs = _analyticsData?.data?.transactions || [];

  const totalEl     = document.getElementById('kpi-total-txs');
  const monthEl     = document.getElementById('kpi-month-total');
  const categoryEl  = document.getElementById('kpi-top-category');
  const activeEl    = document.getElementById('kpi-active-products');
  const monthSubEl  = document.getElementById('kpi-month-sub');

  if (totalEl) totalEl.textContent = txs.length.toString();

  const currentMonthTxs = txs.filter(t => (t.transaction_date || '').startsWith(_analyticsSelectedMonth));

  if (monthSubEl) {
    const monthObj = getMonthRangeKeys(12).find(m => m.key === _analyticsSelectedMonth);
    monthSubEl.textContent = monthObj ? monthObj.label : _analyticsSelectedMonth;
  }

  if (monthEl) {
    if (_analyticsData?.has_price_data) {
      const totalTL = currentMonthTxs.reduce((sum, t) => sum + (parseFloat(t.quantity || 0) * parseFloat(t.products?.unit_price || t.unit_price || 0)), 0);
      monthEl.textContent = `₺${totalTL.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      const totalQty = currentMonthTxs.reduce((sum, t) => sum + parseFloat(t.quantity || 0), 0);
      monthEl.textContent = `${totalQty.toFixed(1)} birim`;
    }
  }

  if (categoryEl) {
    const catMap = {};
    currentMonthTxs.forEach(t => {
      const cat = t.products?.category || 'Diğer';
      catMap[cat] = (catMap[cat] || 0) + parseFloat(t.quantity || 0);
    });
    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    categoryEl.textContent = sortedCats.length > 0 ? sortedCats[0][0].toUpperCase() : '—';
  }

  if (activeEl) {
    const distinctProds = new Set(txs.map(t => t.product_id));
    activeEl.textContent = distinctProds.size.toString();
  }
}

function setAnalysisMetricMode(mode) {
  _analyticsMetricMode = mode;
  document.getElementById('btn-mode-tl')?.classList.toggle('active', mode === 'tl');
  document.getElementById('btn-mode-qty')?.classList.toggle('active', mode === 'qty');
  renderMonthlyConsumptionChart();
}

function setAnalysisRange(n) {
  _analyticsRange = n;
  document.getElementById('btn-range-6')?.classList.toggle('active', n === 6);
  document.getElementById('btn-range-12')?.classList.toggle('active', n === 12);
  renderMonthlyConsumptionChart();
  renderProductTrendChart();
}

function onAnalysisMonthChange() {
  const select = document.getElementById('analysis-month-select');
  if (select) {
    _analyticsSelectedMonth = select.value;
    updateAnalysisKPIs();
    renderCategoryDistChart();
    renderTopProductsChart();
  }
}

function onAnalysisProductChange() {
  const select = document.getElementById('analysis-product-select');
  if (select) {
    _analyticsSelectedProductId = parseInt(select.value, 10);
    renderProductTrendChart();
  }
}

// ── 1. GENEL AYLIK TÜKETİM GRAFİĞİ ──────────────────────────────────────────
function renderMonthlyConsumptionChart() {
  const ctx = document.getElementById('chart-monthly-consumption')?.getContext('2d');
  if (!ctx) return;

  if (_chartMonthly) _chartMonthly.destroy();

  const txs = _analyticsData?.data?.transactions || [];
  const hasPrice = !!_analyticsData?.has_price_data;
  const showTL = (_analyticsMetricMode === 'tl' && hasPrice);
  const monthList = getMonthRangeKeys(_analyticsRange);
  const labels = monthList.map(m => m.shortLabel);

  const titleEl = document.getElementById('main-chart-title');
  const subEl   = document.getElementById('main-chart-subtitle');

  if (showTL) {
    if (titleEl) titleEl.textContent = '📈 Genel Aylık Tüketim Tutarı (TL)';
    if (subEl)   subEl.textContent   = 'Her ayın toplam parasal tüketim tutarı (Miktar × Birim Alış Fiyatı)';

    const monthlyValues = monthList.map(m => {
      const monthTxs = txs.filter(t => (t.transaction_date || '').startsWith(m.key));
      return monthTxs.reduce((sum, t) => sum + (parseFloat(t.quantity || 0) * parseFloat(t.products?.unit_price || t.unit_price || 0)), 0);
    });

    _chartMonthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Toplam Tüketim (₺)',
          data: monthlyValues,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        ...getChartDefaultOptions(),
        plugins: {
          ...getChartDefaultOptions().plugins,
          tooltip: {
            ...getChartDefaultOptions().plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ₺${(ctx.raw || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
            }
          }
        }
      }
    });
  } else {
    // KATEGORİ BAZLI GRUPLU ÇUBUK GRAFİK (Miktar veya Fiyat Eksik Modu)
    if (titleEl) titleEl.textContent = '📈 Genel Aylık Tüketim (Kategori Bazlı)';
    if (subEl) {
      subEl.textContent = hasPrice
        ? 'Kategorilere göre aylık tüketilen malzeme miktarları'
        : 'Birim fiyat verisi bulunmadığından kategorilere göre gruplanmış tüketim miktarları';
    }

    const catSet = new Set();
    txs.forEach(t => { if (t.products?.category) catSet.add(t.products.category); });
    let categories = Array.from(catSet);
    if (categories.length === 0) {
      categories = ['sebze', 'meyve', 'et & balık', 'süt ürünleri', 'bakliyat', 'tahıl'];
    }

    const datasets = categories.map(cat => {
      const col = getCategoryColor(cat);
      const data = monthList.map(m => {
        const monthTxs = txs.filter(t => (t.transaction_date || '').startsWith(m.key) && (t.products?.category || '').toLowerCase() === cat.toLowerCase());
        return monthTxs.reduce((sum, t) => sum + parseFloat(t.quantity || 0), 0);
      });
      return {
        label: cat.toUpperCase(),
        data,
        backgroundColor: col.bg,
        borderColor: col.border,
        borderWidth: 1,
        borderRadius: 4
      };
    });

    _chartMonthly = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        ...getChartDefaultOptions(),
        scales: {
          ...getChartDefaultOptions().scales,
          y: {
            ...getChartDefaultOptions().scales.y,
            title: { display: true, text: 'Miktar', color: '#94a3b8' }
          }
        }
      }
    });
  }
}

// ── 2. KATEGORİ DAĞILIMI (SEÇİLEN AY) ────────────────────────────────────────
function renderCategoryDistChart() {
  const ctx = document.getElementById('chart-category-dist')?.getContext('2d');
  if (!ctx) return;

  if (_chartCategory) _chartCategory.destroy();

  const txs = _analyticsData?.data?.transactions || [];
  const monthTxs = txs.filter(t => (t.transaction_date || '').startsWith(_analyticsSelectedMonth));

  const catMap = {};
  monthTxs.forEach(t => {
    const cat = t.products?.category || 'Diğer';
    catMap[cat] = (catMap[cat] || 0) + parseFloat(t.quantity || 0);
  });

  const subEl = document.getElementById('cat-dist-subtitle');
  const monthObj = getMonthRangeKeys(12).find(m => m.key === _analyticsSelectedMonth);
  if (subEl) subEl.textContent = `${monthObj ? monthObj.label : _analyticsSelectedMonth} ayı kategori bazlı toplam tüketim payı`;

  const labels = Object.keys(catMap);
  const dataValues = Object.values(catMap);

  if (labels.length === 0) {
    _chartCategory = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Bu Ay Henüz Kayıt Yok'],
        datasets: [{ data: [1], backgroundColor: ['rgba(148, 163, 184, 0.15)'], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } },
          tooltip: { enabled: false }
        }
      }
    });
    return;
  }

  const bgColors = labels.map(c => getCategoryColor(c).bg);
  const borderColors = labels.map(c => getCategoryColor(c).border);
  const total = dataValues.reduce((a, b) => a + b, 0);

  _chartCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: dataValues,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        ...getChartDefaultOptions().plugins,
        legend: {
          ...getChartDefaultOptions().plugins.legend,
          position: 'bottom'
        },
        tooltip: {
          ...getChartDefaultOptions().plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw || 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${val.toFixed(2)} birim (%${pct})`;
            }
          }
        }
      }
    }
  });
}

// ── 3. EN ÇOK TÜKETİLEN 10 ÜRÜN (SEÇİLEN AY) ──────────────────────────────────
function renderTopProductsChart() {
  const ctx = document.getElementById('chart-top-products')?.getContext('2d');
  if (!ctx) return;

  if (_chartTopProducts) _chartTopProducts.destroy();

  const txs = _analyticsData?.data?.transactions || [];
  const monthTxs = txs.filter(t => (t.transaction_date || '').startsWith(_analyticsSelectedMonth));

  const prodMap = {};
  monthTxs.forEach(t => {
    const pid = t.product_id;
    if (!prodMap[pid]) {
      prodMap[pid] = {
        name: t.products?.name || `Ürün #${pid}`,
        unit: t.products?.unit || '',
        category: t.products?.category || '',
        quantity: 0
      };
    }
    prodMap[pid].quantity += parseFloat(t.quantity || 0);
  });

  const subEl = document.getElementById('top-prod-subtitle');
  const monthObj = getMonthRangeKeys(12).find(m => m.key === _analyticsSelectedMonth);
  if (subEl) subEl.textContent = `${monthObj ? monthObj.label : _analyticsSelectedMonth} ayında en yüksek sarfiyat yapılan 10 malzeme`;

  const sorted = Object.values(prodMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  if (sorted.length === 0) {
    _chartTopProducts = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Bu Ay Henüz Kayıt Yok'],
        datasets: [{ data: [0], backgroundColor: ['rgba(148, 163, 184, 0.15)'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
    return;
  }

  const reversed = [...sorted].reverse();
  const labels = reversed.map(p => p.name);
  const dataValues = reversed.map(p => p.quantity);
  const units = reversed.map(p => p.unit);
  const bgColors = reversed.map(p => getCategoryColor(p.category).bg);
  const borderColors = reversed.map(p => getCategoryColor(p.category).border);

  _chartTopProducts = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tüketim Miktarı',
        data: dataValues,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      ...getChartDefaultOptions(),
      indexAxis: 'y',
      plugins: {
        ...getChartDefaultOptions().plugins,
        legend: { display: false },
        tooltip: {
          ...getChartDefaultOptions().plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const u = units[ctx.dataIndex] || '';
              return ` ${ctx.formattedValue} ${u}`;
            }
          }
        }
      }
    }
  });
}

// ── 4. ÜRÜN BAZLI TÜKETİM TRENDİ ──────────────────────────────────────────────
function renderProductTrendChart() {
  const ctx = document.getElementById('chart-product-trend')?.getContext('2d');
  if (!ctx) return;

  if (_chartProductTrend) _chartProductTrend.destroy();

  const txs = _analyticsData?.data?.transactions || [];
  const prods = _analyticsData?.data?.products || [];
  const monthList = getMonthRangeKeys(_analyticsRange);
  const labels = monthList.map(m => m.shortLabel);

  const selectedProd = prods.find(p => p.id == _analyticsSelectedProductId);
  const prodName = selectedProd ? selectedProd.name : 'Seçilen Ürün';
  const prodUnit = selectedProd ? selectedProd.unit : '';
  const prodCategory = selectedProd ? selectedProd.category : '';
  const prodPrice = (selectedProd?.unit_price != null && !isNaN(parseFloat(selectedProd.unit_price)) && parseFloat(selectedProd.unit_price) > 0)
    ? parseFloat(selectedProd.unit_price)
    : null;

  const subEl = document.getElementById('prod-trend-subtitle');
  const priceBadge = document.getElementById('prod-trend-price-badge');

  if (priceBadge) {
    if (prodPrice != null) {
      priceBadge.textContent = `Birim Alış: ₺${prodPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${prodUnit}`;
      priceBadge.classList.remove('hidden');
    } else {
      priceBadge.textContent = 'Birim Fiyat: Belirtilmemiş';
      priceBadge.classList.remove('hidden');
    }
  }

  const priceNote = prodPrice != null 
    ? ` • Güncel Alış Fiyatı: ₺${prodPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${prodUnit}`
    : '';

  if (subEl) subEl.textContent = `"${prodName}" ürününün son ${_analyticsRange} aydaki tüketim eğrisi${priceNote}`;

  const values = monthList.map(m => {
    const pTxs = txs.filter(t => t.product_id == _analyticsSelectedProductId && (t.transaction_date || '').startsWith(m.key));
    return pTxs.reduce((sum, t) => sum + parseFloat(t.quantity || 0), 0);
  });

  const col = getCategoryColor(prodCategory);

  _chartProductTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${prodName} (${prodUnit})`,
        data: values,
        borderColor: col.border || '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: col.border || '#10b981',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 7
      }]
    },
    options: {
      ...getChartDefaultOptions(),
      plugins: {
        ...getChartDefaultOptions().plugins,
        tooltip: {
          ...getChartDefaultOptions().plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const qty = parseFloat(ctx.raw || 0);
              let tip = ` ${prodName}: ${ctx.formattedValue} ${prodUnit}`;
              if (prodPrice != null && qty > 0) {
                const cost = (qty * prodPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                tip += ` (~₺${cost})`;
              }
              return tip;
            }
          }
        }
      },
      scales: {
        ...getChartDefaultOptions().scales,
        y: {
          ...getChartDefaultOptions().scales.y,
          title: { display: true, text: prodUnit ? `Miktar (${prodUnit})` : 'Miktar', color: '#94a3b8' }
        }
      }
    }
  });
}

