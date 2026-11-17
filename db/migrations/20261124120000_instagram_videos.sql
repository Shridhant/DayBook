-- migrate:up
-- Optional short clip per Instagram post, uploaded by the salon (/uploads/instagram/<uuid>.mp4|.webm).
-- The landing page shows it muted as the card's preview and plays it on desktop hover.
alter table instagram_posts add column video_path text;

-- migrate:down
alter table instagram_posts drop column video_path;
