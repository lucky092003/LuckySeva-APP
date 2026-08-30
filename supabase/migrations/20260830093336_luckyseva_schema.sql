/*
# LuckySeva — service marketplace schema + seed data

1. New Tables
- `categories` — service categories (Electrician, Plumber, etc.) with icon name (lucide) and accent color.
- `services` — concrete services offered under each category, with starting price (INR) and estimated duration.
- `professionals` — service provider profiles: name, skills, experience, rating, completed jobs, starting price, distance, availability status, avatar url.
- `professional_services` — many-to-many link between professionals and the services they offer (with their own price).
- `bookings` — customer bookings with status lifecycle, address, scheduled date/time, payment method, price breakdown.
- `reviews` — customer reviews for professionals after service completion (1-5 stars + comment).

2. Security
- Single-tenant demo marketplace: data is intentionally shared/public so the anon-key frontend can read everything and create bookings/reviews. RLS enabled on every table with `TO anon, authenticated` CRUD policies.

3. Notes
- Prices stored in INR rupees as numeric.
- Booking status is a text enum: 'confirmed','assigned','on_the_way','started','completed','cancelled'.
- Seeded with realistic Indian names, the 10 requested categories, ~21 services, ~12 professionals and a few reviews.
*/

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  starting_price numeric NOT NULL DEFAULT 0,
  estimated_duration text NOT NULL DEFAULT '',
  popular boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_slug text NOT NULL,
  skills text[] NOT NULL DEFAULT '{}',
  experience_years int NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  reviews_count int NOT NULL DEFAULT 0,
  completed_jobs int NOT NULL DEFAULT 0,
  starting_price numeric NOT NULL DEFAULT 0,
  avatar_url text NOT NULL DEFAULT '',
  distance_km numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  bio text NOT NULL DEFAULT '',
  service_area text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  UNIQUE (professional_id, service_id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL,
  professional_name text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time text NOT NULL,
  notes text NOT NULL DEFAULT '',
  base_price numeric NOT NULL DEFAULT 0,
  visit_fee numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  rating int NOT NULL DEFAULT 5,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_professionals_category ON professionals(category_slug);
CREATE INDEX IF NOT EXISTS idx_prof_services_prof ON professional_services(professional_id);
CREATE INDEX IF NOT EXISTS idx_prof_services_service ON professional_services(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_professional ON bookings(professional_id);
CREATE INDEX IF NOT EXISTS idx_reviews_professional ON reviews(professional_id);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_services" ON services;
CREATE POLICY "anon_select_services" ON services FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_services" ON services;
CREATE POLICY "anon_insert_services" ON services FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_services" ON services;
CREATE POLICY "anon_update_services" ON services FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_professionals" ON professionals;
CREATE POLICY "anon_select_professionals" ON professionals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_professionals" ON professionals;
CREATE POLICY "anon_insert_professionals" ON professionals FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_professionals" ON professionals;
CREATE POLICY "anon_update_professionals" ON professionals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_prof_services" ON professional_services;
CREATE POLICY "anon_select_prof_services" ON professional_services FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_prof_services" ON professional_services;
CREATE POLICY "anon_insert_prof_services" ON professional_services FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_prof_services" ON professional_services;
CREATE POLICY "anon_update_prof_services" ON professional_services FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_bookings" ON bookings;
CREATE POLICY "anon_select_bookings" ON bookings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;
CREATE POLICY "anon_insert_bookings" ON bookings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_bookings" ON bookings;
CREATE POLICY "anon_update_bookings" ON bookings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_reviews" ON reviews;
CREATE POLICY "anon_select_reviews" ON reviews FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reviews" ON reviews;
CREATE POLICY "anon_insert_reviews" ON reviews FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reviews" ON reviews;
CREATE POLICY "anon_update_reviews" ON reviews FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO categories (name, slug, icon, color, description, sort_order) VALUES
('Electrician','electrician','Zap','#f59e0b','Wiring, repairs, installations and electrical safety checks.',1),
('Plumber','plumber','Droplets','#0ea5e9','Leaks, taps, pipes, drainage and bathroom fittings.',2),
('AC Repair','ac-repair','Snowflake','#0891b2','AC service, gas refill, installation and deep cleaning.',3),
('Cleaning','cleaning','Sparkles','#10b981','Home, kitchen, bathroom and sofa deep cleaning.',4),
('Carpenter','carpenter','Hammer','#a16207','Furniture repair, door fixes and custom woodwork.',5),
('Painting','painting','PaintRoller','#ec4899','Interior, exterior and texture painting for homes.',6),
('Appliance Repair','appliance-repair','WashingMachine','#6366f1','Washing machine, microwave, fridge and geyser repair.',7),
('Beauty & Salon','beauty-salon','Scissors','#db2777','Salon at home: haircut, facial, waxing and spa.',8),
('Pest Control','pest-control','Bug','#84cc16','Termite, cockroach and general pest treatment.',9),
('Other Services','other','MoreHorizontal','#64748b','Miscellaneous home services and repairs.',10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO services (category_id, name, description, starting_price, estimated_duration, popular)
SELECT c.id, s.name, s.description, s.price, s.duration, s.popular
FROM categories c
JOIN (VALUES
  ('electrician','Switch & Socket Repair','Replacement of faulty switches, sockets and plates.',149,'45 mins',true),
  ('electrician','Full House Wiring','Complete rewiring with safety inspection.',4999,'1 day',false),
  ('electrician','Inverter & Battery Setup','Install or service home inverter systems.',799,'2 hrs',false),
  ('plumber','Tap & Mixer Repair','Fix leaking taps and replace mixers.',99,'30 mins',true),
  ('plumber','Drainage Unclogging','Clear blocked drains and kitchen sinks.',199,'1 hr',true),
  ('plumber','Bathroom Fittings','Install shower, jet spray and fittings.',399,'2 hrs',false),
  ('ac-repair','AC Service & Cleaning','Deep cleaning and performance check.',499,'1 hr',true),
  ('ac-repair','AC Gas Refill','Top up refrigerant gas for cooling.',1499,'1 hr',false),
  ('ac-repair','AC Installation','Install split or window AC unit.',999,'2 hrs',true),
  ('cleaning','Full Home Deep Cleaning','Complete deep clean of entire home.',2499,'4 hrs',true),
  ('cleaning','Bathroom Deep Cleaning','Sanitise and deep clean bathrooms.',499,'1 hr',false),
  ('cleaning','Kitchen Deep Cleaning','Degrease and sanitise kitchen.',699,'2 hrs',false),
  ('carpenter','Door & Hinge Repair','Fix squeaky doors, hinges and locks.',149,'45 mins',true),
  ('carpenter','Furniture Repair','Repair chairs, tables and beds.',399,'2 hrs',false),
  ('painting','1 BHK Painting','Paint walls and ceiling of 1 BHK.',4999,'1 day',true),
  ('painting','Wall Texture & Design','Designer texture for a single wall.',1999,'6 hrs',false),
  ('appliance-repair','Washing Machine Repair','Diagnose and fix washing machine issues.',299,'1 hr',true),
  ('beauty-salon','Salon Prime for Women','Haircut, facial, waxing and threading.',1499,'2 hrs',true),
  ('beauty-salon','Mens Haircut at Home','Professional haircut and beard styling.',199,'30 mins',true),
  ('pest-control','Cockroach Treatment','Gel and spray treatment for cockroaches.',799,'1 hr',false),
  ('other','Smart Lock Installation','Install and configure smart door locks.',599,'1 hr',false)
) AS s(slug, name, description, price, duration, popular) ON c.slug = s.slug
ON CONFLICT DO NOTHING;

INSERT INTO professionals (name, category_slug, skills, experience_years, rating, reviews_count, completed_jobs, starting_price, avatar_url, distance_km, status, bio, service_area) VALUES
('Rajesh Kumar','electrician',ARRAY['Wiring','Switchboards','Inverter'],8,4.8,213,540,149,'https://i.pravatar.cc/200?img=12',1.2,'available','Licensed electrician with 8 years experience in residential wiring and safety audits.','Koramangala, Indiranagar'),
('Suresh Patel','plumber',ARRAY['Taps','Drainage','Bathroom fittings'],11,4.9,320,890,99,'https://i.pravatar.cc/200?img=13',2.4,'available','Expert plumber solving leaks and drainage issues across the city for over a decade.','HSR Layout, BTM'),
('Imran Khan','ac-repair',ARRAY['Split AC','Window AC','Gas Refill'],6,4.7,156,410,499,'https://i.pravatar.cc/200?img=14',3.1,'busy','Certified AC technician specialising in servicing and gas refills.','Whitefield, Marathahalli'),
('Anjali Sharma','cleaning',ARRAY['Deep cleaning','Sofa cleaning','Kitchen'],5,4.9,278,720,499,'https://i.pravatar.cc/200?img=45',1.8,'available','Thorough home cleaning specialist with attention to detail.','Jayanagar, JP Nagar'),
('Mohammed Yusuf','carpenter',ARRAY['Furniture repair','Doors','Custom woodwork'],14,4.8,190,630,149,'https://i.pravatar.cc/200?img=15',4.2,'available','Master carpenter crafting and repairing furniture for 14 years.','Malleshwaram, Rajajinagar'),
('Vikram Singh','painting',ARRAY['Interior','Exterior','Texture'],9,4.6,142,380,1999,'https://i.pravatar.cc/200?img=16',5.0,'available','Painter delivering smooth finishes and modern texture designs.','Electronic City, Bommanahalli'),
('Priya Nair','beauty-salon',ARRAY['Haircut','Facial','Waxing','Spa'],7,4.9,305,840,199,'https://i.pravatar.cc/200?img=47',1.5,'available','Certified beautician offering premium salon services at home.','Indiranagar, Domlur'),
('Deepak Reddy','appliance-repair',ARRAY['Washing machine','Microwave','Fridge'],10,4.7,168,520,299,'https://i.pravatar.cc/200?img=17',2.9,'busy','Appliance technician repairing all major brands at home.','Banashankari, Vijayanagar'),
('Sunil Joshi','pest-control',ARRAY['Termite','Cockroach','General pest'],12,4.6,98,310,799,'https://i.pravatar.cc/200?img=18',6.3,'available','Pest control expert using safe, family-friendly treatments.','Hebbal, Yelahanka'),
('Lakshmi Iyer','cleaning',ARRAY['Bathroom','Kitchen','Deep cleaning'],4,4.8,134,360,499,'https://i.pravatar.cc/200?img=48',2.0,'available','Detail-oriented cleaning professional trusted by families.','Koramangala, BTM'),
('Arjun Mehta','electrician',ARRAY['Wiring','Smart home','Inverter'],6,4.5,87,240,149,'https://i.pravatar.cc/200?img=19',3.5,'available','Young electrician skilled in smart home setups and modern wiring.','HSR Layout, Bellandur'),
('Ravi Teja','ac-repair',ARRAY['Split AC','Installation','Service'],5,4.7,112,300,499,'https://i.pravatar.cc/200?img=20',2.7,'available','AC technician known for quick installation and reliable servicing.','Marathahalli, Whitefield')
ON CONFLICT DO NOTHING;

INSERT INTO reviews (professional_id, customer_name, rating, comment)
SELECT p.id, r.customer, r.rating, r.comment
FROM professionals p
JOIN (VALUES
  ('Rajesh Kumar','Asha',5,'Very professional and finished the wiring quickly. Highly recommended.'),
  ('Rajesh Kumar','Manoj',4,'Good work, arrived a bit late but fixed everything perfectly.'),
  ('Suresh Patel','Kavya',5,'Solved a stubborn leak in minutes. Polite and tidy.'),
  ('Anjali Sharma','Rohit',5,'Our flat looked brand new after deep cleaning. Amazing job.'),
  ('Priya Nair','Sneha',5,'Best salon at home experience. Very hygienic and skilled.')
) AS r(name, customer, rating, comment) ON p.name = r.name
ON CONFLICT DO NOTHING;
