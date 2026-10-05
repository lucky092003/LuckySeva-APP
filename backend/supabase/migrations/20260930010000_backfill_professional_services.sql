/*
# LuckySeva — backfill `professional_services` links (repeatable)

The first seed (20260912000000) ran before the self-signed providers existed and
provider creation never wrote links, so `professional_services` was empty again.
Service Detail then showed "No professionals available for this service yet"
even though matching providers were in the same category, at the same location.

Re-links every professional to every service of their `category_slug` at the
service's starting price. Safe to run repeatedly: the UNIQUE
(professional_id, service_id) constraint makes the insert a no-op the second time.
*/

INSERT INTO professional_services (professional_id, service_id, price)
SELECT p.id, s.id, s.starting_price
FROM professionals p
JOIN categories c ON c.slug = p.category_slug
JOIN services s ON s.category_id = c.id
ON CONFLICT (professional_id, service_id) DO NOTHING;

-- Removing links that point outside the professional's current category.
DELETE FROM professional_services ps
WHERE EXISTS (
  SELECT 1
  FROM professionals p
  JOIN services s ON s.id = ps.service_id
  JOIN categories c ON c.id = s.category_id
  WHERE p.id = ps.professional_id
    AND p.category_slug <> c.slug
);
