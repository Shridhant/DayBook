-- migrate:up
-- Optional cover photo per service category: categories with one appear as photo tiles on the
-- landing page. An upload (/uploads/services/<uuid>.webp) or a bundled image (/site/…, /placeholders/…).
alter table service_categories add column image_path text;

-- migrate:down
alter table service_categories drop column image_path;
