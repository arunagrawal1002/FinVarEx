-- Re-key seasonal_index by (dept_id, store_type, iso_week) instead of
-- (dept_id, iso_week).
--
-- Validated via ad-hoc analysis: pooling seasonal_index across all 45
-- stores per department is a materially poor fit for many individual
-- stores (avg within-dept store-vs-pooled-index correlation as low as
-- 0.51 for some departments, some individual stores near-zero or
-- negative). Region/climate (stores.region_name) does NOT explain the
-- heterogeneity -- same-region store pairs are statistically
-- indistinguishable from cross-region pairs across 71 departments tested
-- (31% same-region-wins, avg gap -0.011), because region_name is
-- synthetic (stores.location_is_assumed = TRUE), not real geography.
-- Store `type` (A/B/C -- an authentic Kaggle field reflecting store
-- format/size) DOES explain it: same-type store pairs beat cross-type
-- pairs in 65/71 departments (avg gap +0.086). Re-keying by store_type
-- captures the real signal without the data-starvation risk of going all
-- the way to per-store granularity (only ~140 weeks of history exist per
-- store-dept combination).

alter table seasonal_index drop constraint seasonal_index_pkey;
alter table seasonal_index add column store_type varchar(1);
truncate table seasonal_index;

with dept_type_week_avg as (
  select sa.dept_id, st.type as store_type,
         extract(week from sa.week_date)::int as iso_week,
         avg(sa.actual_sales) as week_avg
  from sales_actuals sa
  join stores st on st.store_id = sa.store_id
  group by sa.dept_id, st.type, extract(week from sa.week_date)::int
),
dept_type_avg as (
  select sa.dept_id, st.type as store_type, avg(sa.actual_sales) as overall_avg
  from sales_actuals sa
  join stores st on st.store_id = sa.store_id
  group by sa.dept_id, st.type
)
insert into seasonal_index (dept_id, store_type, iso_week, seasonal_index)
select w.dept_id, w.store_type, w.iso_week,
       round((w.week_avg / a.overall_avg)::numeric, 3)
from dept_type_week_avg w
join dept_type_avg a using (dept_id, store_type)
where a.overall_avg is not null and a.overall_avg != 0;

alter table seasonal_index alter column store_type set not null;
alter table seasonal_index add primary key (dept_id, store_type, iso_week);
