/*
# LuckySeva — seed `professional_services` links

The `professional_services` table was created but never populated, which left
service→professional lookups empty (Service Detail showed "No professionals
available" and the professional profile "Book Now" button was disabled).

This backfills one link (at the service's starting price) for every
professional for each service in their category. Idempotent thanks to the
UNIQUE(professional_id, service_id) constraint.
*/

INSERT INTO professional_services (professional_id, service_id, price)
SELECT p.id, s.id, s.starting_price
FROM professionals p
JOIN categories c ON c.slug = p.category_slug
JOIN services s ON s.category_id = c.id
ON CONFLICT (professional_id, service_id) DO NOTHING;