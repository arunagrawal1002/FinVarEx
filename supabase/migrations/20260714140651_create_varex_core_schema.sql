-- 1. STORES (dimension table)
CREATE TABLE stores (
    store_id            INT PRIMARY KEY,
    type                VARCHAR(1),
    size                INT,
    latitude            DECIMAL(9,6),
    longitude           DECIMAL(9,6),
    region_name         VARCHAR(50),
    location_is_assumed BOOLEAN DEFAULT TRUE
);

-- 2. SALES ACTUALS (raw fact table)
CREATE TABLE sales_actuals (
    id           BIGSERIAL PRIMARY KEY,
    store_id     INT REFERENCES stores(store_id),
    dept_id      INT,
    week_date    DATE,
    actual_sales DECIMAL(12,2),
    is_holiday   BOOLEAN,
    UNIQUE (store_id, dept_id, week_date)
);
CREATE INDEX idx_sales_lookup ON sales_actuals (store_id, dept_id, week_date);

-- 3. SALES FORECASTS (independent ARIMA baseline, precomputed offline)
CREATE TABLE sales_forecasts (
    id              BIGSERIAL PRIMARY KEY,
    store_id        INT REFERENCES stores(store_id),
    dept_id         INT,
    week_date       DATE,
    forecast_sales  DECIMAL(12,2),
    model_type      VARCHAR(30),   -- 'SARIMAX(1,1,1)+holiday_exog' or 'rolling_avg_fallback'
    fit_cutoff_date DATE,          -- proves the model never saw data at/after this date (no lookahead)
    UNIQUE (store_id, dept_id, week_date)
);
CREATE INDEX idx_forecast_lookup ON sales_forecasts (store_id, dept_id, week_date);

-- 4. WEEKLY ENVIRONMENTAL CONTEXT (weather + macro + markdown)
CREATE TABLE weekly_environmental_context (
    id                      BIGSERIAL PRIMARY KEY,
    store_id                INT REFERENCES stores(store_id),
    week_date               DATE,
    fuel_price              DECIMAL(4,2),
    markdown_total          DECIMAL(12,2),
    cpi                     DECIMAL(6,3),
    unemployment_rate       DECIMAL(4,2),
    consumer_sentiment      DECIMAL(4,1),
    disposable_income_idx   DECIMAL(6,2),
    wti_oil_price           DECIMAL(6,2),
    precipitation_weekly_mm DECIMAL(6,2),
    temp_avg                DECIMAL(4,1),
    severe_weather_flag     BOOLEAN,
    UNIQUE (store_id, week_date)
);
CREATE INDEX idx_env_lookup ON weekly_environmental_context (store_id, week_date);

-- 5. COMPETITOR INTELLIGENCE (synthetic, disclosed)
CREATE TABLE competitor_intelligence (
    competitor_id     BIGSERIAL PRIMARY KEY,
    store_id          INT REFERENCES stores(store_id),
    competitor_brand  VARCHAR(50),
    distance_miles    DECIMAL(4,2),
    launch_date       DATE,
    data_is_synthetic BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_competitor_lookup ON competitor_intelligence (store_id);

-- 6. SEASONAL INDEX (week-of-year reference per department)
CREATE TABLE seasonal_index (
    dept_id        INT,
    iso_week       INT,             -- 1-52
    seasonal_index DECIMAL(5,3),    -- ratio to that dept's average week, across all stores/years
    PRIMARY KEY (dept_id, iso_week)
);

-- 7. VARIANCE REPORTS (AI output + audit log)
CREATE TABLE variance_reports (
    id                   BIGSERIAL PRIMARY KEY,
    store_id             INT REFERENCES stores(store_id),
    dept_id              INT,
    target_month         DATE,
    generated_at         TIMESTAMP DEFAULT NOW(),
    input_snapshot       JSONB,
    mathematical_drivers JSONB,     -- z-scores + yoy_pct + seasonal_expected_pct + competitor_impact_score
    classification       VARCHAR(30) CHECK (classification IN
                          ('On Track','Volume','Price','Timing','Weather Anomaly',
                           'Force Majeure','Competitive Pressure','Anomaly')),
    rubric_bucket        VARCHAR(20) CHECK (rubric_bucket IN ('Volume','Price','Timing','Anomaly')),
    ai_explanation       TEXT,
    confidence_score     INT CHECK (confidence_score BETWEEN 0 AND 100),
    system_flags         TEXT[]
);
CREATE INDEX idx_reports_lookup ON variance_reports (store_id, dept_id, target_month);
