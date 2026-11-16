-- migrate:up
-- Optional photo per service: shown on the landing page and in the booking flow.
-- An uploaded file (/uploads/services/<uuid>.webp) or a bundled placeholder (/placeholders/…).
alter table services add column image_path text;

-- migrate:down
alter table services drop column image_path;
