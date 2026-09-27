/*
# LuckySeva — add the `physiotherapy` service category

Adds a physiotherapy category (icon: Activity) plus its starter services, and
pushes `other` to the end of the sort order so it stays the catch-all. Both
statements are idempotent so re-running the migration is a no-op.
*/

INSERT INTO categories (name, slug, icon, color, description, sort_order) VALUES
('Physiotherapy','physiotherapy','Activity','#9333ea','Home physio for pain relief, injury rehab and post-surgery recovery.',10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

UPDATE categories SET sort_order = 11 WHERE slug = 'other';

INSERT INTO services (category_id, name, description, starting_price, estimated_duration, popular)
SELECT c.id, s.name, s.description, s.price, s.duration, s.popular
FROM categories c
JOIN (VALUES
  ('physiotherapy','Physiotherapy Session at Home','Full body assessment and guided therapy session.',599,'60 mins',true),
  ('physiotherapy','Back & Neck Pain Relief','Targeted therapy to reduce stiffness and pain.',449,'45 mins',true),
  ('physiotherapy','Sports Injury Rehab','Recovery programme for sprains, strains and ligament injuries.',699,'1 hr',false),
  ('physiotherapy','Post-Surgery Rehabilitation','Safe mobility and strength recovery after surgery.',899,'2 hrs',false),
  ('physiotherapy','Knee & Joint Pain Therapy','Exercises and manual therapy for knee and joint pain.',499,'45 mins',false)
) AS s(slug, name, description, price, duration, popular) ON c.slug = s.slug
-- `services` has no unique constraint, so guard on the name instead of ON CONFLICT.
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = s.name);

-- Link any physiotherapist to the new services so service→professional lookups resolve.
INSERT INTO professional_services (professional_id, service_id, price)
SELECT p.id, s.id, s.starting_price
FROM professionals p
JOIN categories c ON c.slug = p.category_slug
JOIN services s ON s.category_id = c.id
WHERE c.slug = 'physiotherapy'
ON CONFLICT (professional_id, service_id) DO NOTHING;
