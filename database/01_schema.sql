-- ============================================================
-- ANAOKULU YEMEKHANE STOK TAKİP SİSTEMİ
-- Tam Şema (v1 + v2 birleşik) — PostgreSQL / Supabase
-- IF NOT EXISTS: birden fazla çalıştırılsa da güvenli
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    unit                VARCHAR(20)  NOT NULL,
    category            VARCHAR(80),
    critical_threshold  NUMERIC(10,2) DEFAULT 0,
    protein_per_unit    NUMERIC(10,3),
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
    id           SERIAL PRIMARY KEY,
    supplier_id  INTEGER REFERENCES suppliers(id),
    invoice_no   VARCHAR(50),
    invoice_date DATE NOT NULL,
    total_amount NUMERIC(12,2),
    source       VARCHAR(20) DEFAULT 'manual',
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id         SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   NUMERIC(10,2) NOT NULL,
    unit_price NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
    id         SERIAL PRIMARY KEY,
    meal_name  VARCHAR(150) NOT NULL,
    meal_type  VARCHAR(20) NOT NULL DEFAULT 'ogle' CHECK (meal_type IN ('kahvalti', 'ogle', 'ikindi')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id                   SERIAL PRIMARY KEY,
    recipe_id            INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    product_id           INTEGER NOT NULL REFERENCES products(id),
    quantity_per_portion NUMERIC(10,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_menu (
    id          SERIAL PRIMARY KEY,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    recipe_id   INTEGER NOT NULL REFERENCES recipes(id),
    meal_type   VARCHAR(20) NOT NULL DEFAULT 'ogle' CHECK (meal_type IN ('kahvalti', 'ogle', 'ikindi')),
    valid_from  DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to    DATE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_plans (
    id            SERIAL PRIMARY KEY,
    plan_date     DATE NOT NULL,
    recipe_id     INTEGER NOT NULL REFERENCES recipes(id),
    meal_type     VARCHAR(20) NOT NULL DEFAULT 'ogle' CHECK (meal_type IN ('kahvalti', 'ogle', 'ikindi')),
    portion_count INTEGER NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_feedback (
    id             SERIAL PRIMARY KEY,
    feedback_date  DATE NOT NULL,
    recipe_id      INTEGER NOT NULL REFERENCES recipes(id),
    feedback_level VARCHAR(10) NOT NULL CHECK (feedback_level IN ('az','normal','cok')),
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id               SERIAL PRIMARY KEY,
    product_id       INTEGER NOT NULL REFERENCES products(id),
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('in','out','waste')),
    quantity         NUMERIC(10,4) NOT NULL,
    source_type      VARCHAR(20) NOT NULL,
    source_id        INTEGER,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS current_stock (
    product_id   INTEGER PRIMARY KEY REFERENCES products(id),
    quantity     NUMERIC(12,4) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Trigger: stock_transactions eklendikçe veya silindikçe current_stock otomatik güncelle
CREATE OR REPLACE FUNCTION update_current_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO current_stock (product_id, quantity, last_updated)
        VALUES (
            NEW.product_id,
            CASE WHEN NEW.transaction_type = 'in' THEN NEW.quantity ELSE -NEW.quantity END,
            NOW()
        )
        ON CONFLICT (product_id) DO UPDATE
        SET quantity = current_stock.quantity +
                CASE WHEN NEW.transaction_type = 'in' THEN NEW.quantity ELSE -NEW.quantity END,
            last_updated = NOW();
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE current_stock
        SET quantity = current_stock.quantity -
                CASE WHEN OLD.transaction_type = 'in' THEN OLD.quantity ELSE -OLD.quantity END,
            last_updated = NOW()
        WHERE product_id = OLD.product_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock ON stock_transactions;
CREATE TRIGGER trg_update_stock
AFTER INSERT OR DELETE ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION update_current_stock();
