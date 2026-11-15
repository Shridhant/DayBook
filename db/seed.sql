-- DEVELOPMENT SEED ONLY. Never run against production.
-- Re-runnable: wipes the catalog, staff, bookings and content tables first.
begin;

truncate payment_events, payments, booking_items, bookings, customers,
         staff_leave, staff_shifts, staff_services, staff, services, service_categories,
         portfolio_items, instagram_posts, testimonials, salon_closures, opening_hours
         restart identity cascade;

update settings set salon_name = 'Daybook', booking_amount_type = 'fixed', booking_amount_fixed_paise = 50000;

-- Open 11:00–20:00 every day (Asia/Kolkata).
insert into opening_hours (weekday, opens_at, closes_at)
select d, '11:00', '20:00' from generate_series(0, 6) as d;

insert into service_categories (name, slug, sort_order) values
  ('Manicure', 'manicure', 1),
  ('Pedicure', 'pedicure', 2),
  ('Extensions', 'extensions', 3),
  ('Nail art', 'nail-art', 4),
  ('Care & removal', 'care-removal', 5);

insert into services (category_id, name, slug, description, price_paise, price_is_from, duration_min, booking_amount_override_paise, sort_order)
select c.id, s.name, s.slug, s.description, s.price, s.is_from, s.minutes, s.override, s.sort
from (values
  ('manicure',     'Classic manicure',          'classic-manicure',     'Shape, cuticle care, buff and regular polish.',        60000,  false, 45,  null,   1),
  ('manicure',     'Gel polish manicure',       'gel-polish-manicure',  'Long-lasting gel colour with a high-shine finish.',    120000, false, 60,  null,   2),
  ('pedicure',     'Spa pedicure',              'spa-pedicure',         'Soak, scrub, massage and polish.',                     100000, false, 60,  null,   1),
  ('pedicure',     'Gel pedicure',              'gel-pedicure',         'Spa pedicure finished with gel colour.',               130000, false, 75,  null,   2),
  ('extensions',   'Gel extensions (full set)', 'gel-extensions',       'Sculpted or tip extensions in your choice of shape.',  250000, false, 120, 100000, 1),
  ('extensions',   'Acrylic extensions',        'acrylic-extensions',   'Strong acrylic set, shaped and finished.',             280000, false, 120, 100000, 2),
  ('extensions',   'Refill',                    'refill',               'Infill for existing extensions (up to 3 weeks).',      150000, false, 90,  null,   3),
  ('nail-art',     'Nail art (full set)',       'nail-art-full-set',    'Hand-painted designs, chrome, French or 3D.',          80000,  true,  45,  null,   1),
  ('nail-art',     'French or chrome finish',   'french-chrome',        'Add-on to any gel service.',                           50000,  false, 30,  null,   2),
  ('care-removal', 'Gel / extension removal',   'removal',              'Safe soak-off removal with nail care.',                40000,  false, 30,  null,   1)
) as s(cat, name, slug, description, price, is_from, minutes, override, sort)
join service_categories c on c.slug = s.cat;

insert into staff (name, slug, specialties, sort_order) values
  ('Riya Sharma',   'riya-sharma',   'Extensions, nail art',  1),
  ('Meera Kapoor',  'meera-kapoor',  'Gel, pedicure',         2),
  ('Anjali Rao',    'anjali-rao',    'Nail art, chrome',      3),
  ('Sana Qureshi',  'sana-qureshi',  'Extensions, refills',   4),
  ('Pooja Verma',   'pooja-verma',   'Manicure, pedicure',    5),
  ('Kavya Nair',    'kavya-nair',    'Gel, nail art',         6);

-- Skills: everyone does manicure, pedicure and removal; extensions and art by specialists.
insert into staff_services (staff_id, service_id)
select st.id, sv.id
from staff st cross join services sv join service_categories c on c.id = sv.category_id
where c.slug in ('manicure', 'pedicure', 'care-removal')
   or (c.slug = 'extensions' and st.slug in ('riya-sharma', 'sana-qureshi'))
   or (c.slug = 'nail-art' and st.slug in ('riya-sharma', 'anjali-rao', 'kavya-nair'));

-- Shifts: full day 11–20 on five days; each person has a weekly off-day and one has a split shift.
insert into staff_shifts (staff_id, weekday, starts_at, ends_at)
select st.id, d, '11:00', '20:00'
from staff st cross join generate_series(0, 6) as d
where d <> (st.sort_order % 7) and st.slug <> 'pooja-verma';

insert into staff_shifts (staff_id, weekday, starts_at, ends_at)
select st.id, d, t.starts_at::time, t.ends_at::time
from staff st cross join generate_series(1, 6) as d
cross join (values ('11:00', '14:00'), ('16:00', '20:00')) as t(starts_at, ends_at)
where st.slug = 'pooja-verma';

insert into testimonials (name, quote, rating, service_label, sort_order) values
  ('Aditi S.', 'Best extensions I''ve had in Gurugram. Three weeks in and not a single lift.', 5, 'Gel extensions', 1),
  ('Neha K.',  'Riya recreated a Pinterest design perfectly. Booking online took a minute.',   5, 'Nail art',       2),
  ('Simran B.','Super hygienic, relaxing pedicure, and they were right on time.',              5, 'Spa pedicure',   3);

commit;
