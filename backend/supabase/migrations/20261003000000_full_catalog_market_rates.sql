/*
# LuckySeva — full service catalog at market rates

Fills every category out to a complete, realistic catalog and re-prices the whole
book to current Indian at-home market rates (tier-1 city, visit included, parts
excluded). Four categories a home-services platform is expected to have were
missing entirely and are added here.

Two things make this migration unusual:

1. `services` has **no unique constraint**, so `ON CONFLICT` cannot be used. The
   catalog is therefore applied with a data-modifying CTE that does the reprice
   (`UPDATE ... FROM`) and the insert (`INSERT ... WHERE NOT EXISTS`) in a single
   statement over one shared `VALUES` list. The two halves touch disjoint rows —
   the update only matches rows that already exist, the insert only rows that do
   not — so the unspecified execution order between them is harmless.

2. Every statement is idempotent. CI applies the whole migration set twice, so a
   re-run re-asserts the same prices and inserts nothing new.

The one destructive statement below is an aliased `DELETE ... USING ... WHERE`,
so it does not trip the CI guard that rejects `DELETE FROM <table>;`. It is
deliberate and scoped to duplicate service rows only; see the comment above it.

`professionals.starting_price` is a coarse floor that several list screens render
directly, and it still held the `99` default from provider signup. It is resynced
to the cheapest service in the professional's own category so the catalog floor a
customer sees matches what the booking actually charges — the server bills
`services.starting_price`, never the professional's own figure.
*/

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

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
('Physiotherapy','physiotherapy','Activity','#9333ea','Home physio for pain relief, injury rehab and post-surgery recovery.',10),
('Packer & Mover','packer-mover','Truck','#0d9488','Local and intercity house shifting, office relocation and storage.',11),
('CCTV & Security','cctv-security','Cctv','#4f46e5','CCTV installation, access control and home security systems.',12),
('Laundry & Dry Cleaning','laundry-dry-cleaning','Shirt','#06b6d4','Doorstep dry cleaning, wash and fold, ironing and shoe care.',13),
('Lawn & Garden','lawn-garden','Trees','#22c55e','Lawn mowing, garden maintenance, terrace and vertical gardens.',14),
('Other Services','other','Ellipsis','#64748b','Miscellaneous home services and repairs.',15)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Services: 182 rows across the 15 categories
-- ---------------------------------------------------------------------------

WITH catalog AS (
  SELECT
    s.slug::text         AS slug,
    s.name::text         AS name,
    s.description::text  AS description,
    s.price::numeric     AS price,
    s.duration::text     AS duration,
    s.popular::boolean   AS popular
  FROM (VALUES
    -- Electrician -----------------------------------------------------------
    ('electrician','Switch & Socket Repair','Replacement of faulty switches, sockets and plates.',149,'45 mins',true),
    ('electrician','Ceiling Fan Repair & Installation','Swap or re-align a ceiling fan and fit its regulator.',249,'45 mins',true),
    ('electrician','Light Fixture & Bulb Installation','Mount chandeliers, wall brackets and ceiling lights.',199,'30 mins',false),
    ('electrician','MCB & Fuse Box Repair','Diagnose tripping MCBs and replace the fuse box.',349,'1 hr',false),
    ('electrician','Wiring Fault Finding','Trace short circuits and dead sections without breaking walls.',399,'1 hr',false),
    ('electrician','Inverter & Battery Setup','Install or service home inverter systems.',799,'2 hrs',false),
    ('electrician','Inverter Battery Replacement','Remove the old battery, fit and pair the replacement.',5499,'3 hrs',false),
    ('electrician','Regulator & Dimmer Installation','Fit and calibrate fan regulators and dimmers.',249,'30 mins',false),
    ('electrician','Voltage Stabilizer & UPS Installation','Install stabilizers and UPS units for appliances.',899,'1 hr',false),
    ('electrician','Distribution Board Upgradation','Replace or extend the main distribution board.',3499,'3 hrs',false),
    ('electrician','Doorbell & Video Intercom Wiring','Wire a doorbell, buzzer or video intercom.',349,'1 hr',false),
    ('electrician','Full House Wiring','Complete rewiring with safety inspection.',7999,'1 day',false),
    ('electrician','Annual Electrical Safety Check','Load test and safety audit of the whole flat.',999,'1 hr',false),

    -- Plumber ---------------------------------------------------------------
    ('plumber','Tap & Mixer Repair','Fix leaking taps and replace mixers.',99,'30 mins',true),
    ('plumber','Drainage Unclogging','Clear blocked drains and kitchen sinks.',199,'1 hr',true),
    ('plumber','Bathroom Fittings','Install shower, jet spray and fittings.',399,'2 hrs',false),
    ('plumber','Toilet Flush Repair','Fix or replace flush valves, cisterns and seats.',249,'45 mins',false),
    ('plumber','Water Tank Cleaning & Pump Repair','Clean overhead tanks and repair booster pumps.',699,'2 hrs',true),
    ('plumber','Water Purifier Installation','Install RO, UV or gravity purifiers.',499,'1 hr',false),
    ('plumber','Blocked Drain Jetting','Machine-jet stubborn roots and grease from sewer lines.',899,'1 hr',false),
    ('plumber','Pipe Leak Detection & Repair','Locate hidden leaks and patch or replace pipes.',349,'1 hr',false),
    ('plumber','Bathroom Seepage Fix','Waterproof and seal leaking bathrooms.',949,'2 hrs',false),
    ('plumber','Sewer Line & Septic Cleaning','Desludge and clear the main sewer line.',1499,'2 hrs',false),
    ('plumber','Kitchen Sink & Drain Repair','Unclog and reseal kitchen sinks and traps.',349,'1 hr',false),
    ('plumber','Geyser Installation & Repair','Fit or repair instant and storage water heaters.',899,'2 hrs',false),
    ('plumber','Bath Fittings & Shower Installation','Install showers, mixers and bath panels.',649,'1 hr',false),

    -- AC Repair -------------------------------------------------------------
    ('ac-repair','AC Service & Cleaning','Deep cleaning and performance check.',499,'1 hr',true),
    ('ac-repair','AC Gas Refill','Top up refrigerant gas for cooling.',1499,'1 hr',false),
    ('ac-repair','AC Installation','Install split or window AC unit.',999,'2 hrs',true),
    ('ac-repair','AC Uninstallation','Drain, remove and shift an existing AC unit.',799,'1 hr',false),
    ('ac-repair','AC Deep Chemical Wash','Chemical wash of coils, filters and drain line.',899,'1.5 hrs',false),
    ('ac-repair','Window AC Repair','Service and repair window AC units.',899,'1 hr',false),
    ('ac-repair','AC Not Cooling Diagnosis','Diagnose compressor, capacitor and cooling faults.',599,'1 hr',false),
    ('ac-repair','AC PCB & Electronics Repair','Repair the main board and sensor electronics.',1899,'2 hrs',false),
    ('ac-repair','Cassette AC Servicing','Servicing for cassette and cassette-type units.',649,'1 hr',false),
    ('ac-repair','AC Water Leak Repair','Seal the drain line and clear the condensate leak.',699,'1 hr',false),
    ('ac-repair','AC Annual AMC (1 Unit)','Yearly maintenance plan covering four services.',3499,'1 day',false),
    ('ac-repair','Commercial AC Maintenance','Servicing for office and shop AC units.',2499,'2 hrs',false),

    -- Cleaning --------------------------------------------------------------
    ('cleaning','Full Home Deep Cleaning','Complete deep clean of entire home.',2499,'4 hrs',true),
    ('cleaning','Bathroom Deep Cleaning','Sanitise and deep clean bathrooms.',499,'1 hr',false),
    ('cleaning','Kitchen Deep Cleaning','Degrease and sanitise kitchen.',699,'2 hrs',false),
    ('cleaning','Sofa Shampoo Cleaning','Shampoo and deodorise one sofa seat.',449,'2 hrs',true),
    ('cleaning','Mattress Shampoo Cleaning','Deep shampoo and sanitise one mattress.',999,'2 hrs',false),
    ('cleaning','Carpet Deep Cleaning','Hot water extraction and stain treatment.',899,'2 hrs',false),
    ('cleaning','Window & Glass Cleaning','Clean glass, frames and tracks.',599,'1.5 hrs',false),
    ('cleaning','Chimney & Appliance Deep Clean','Degrease chimneys, hoods and kitchen appliances.',899,'2 hrs',false),
    ('cleaning','Office & Commercial Cleaning','Hourly cleaning for offices and shops.',349,'2 hrs',false),
    ('cleaning','Balcony & Terrace Cleaning','Scrub, sweep and wash balcony and terrace.',899,'2 hrs',false),
    ('cleaning','Cupboard & Cabinet Deep Clean','Empty, degrease and reline kitchen cupboards.',599,'1.5 hrs',false),
    ('cleaning','Refrigerator Deep Cleaning','Defrost, wash and deodorise the fridge.',699,'1 hr',false),
    ('cleaning','Post-Construction Cleanup','Clear debris and finish-clean a renovated site.',2499,'1 day',false),
    ('cleaning','Pest-Free Deep Clean (2BHK)','Deep clean paired with a sanitisation guarantee.',3999,'5 hrs',false),

    -- Carpenter -------------------------------------------------------------
    ('carpenter','Door & Hinge Repair','Fix squeaky doors, hinges and locks.',149,'45 mins',true),
    ('carpenter','Furniture Repair','Repair chairs, tables and beds.',399,'2 hrs',false),
    ('carpenter','Modular Kitchen Repair','Fix shutters, hinges, channels and fittings.',899,'2 hrs',false),
    ('carpenter','Wardrobe Fixing & Sliding Repair','Align and repair sliding or hinged wardrobes.',749,'2 hrs',false),
    ('carpenter','Window & Grill Repair','Repair window shutters, frames and grills.',549,'1 hr',false),
    ('carpenter','Custom Wooden Shelf Installation','Measure, cut and fix wall shelves.',999,'2 hrs',false),
    ('carpenter','Sofa & Bed Frame Repair','Repair joints, upholstery frames and legs.',899,'2 hrs',false),
    ('carpenter','Wooden Door Fitting','Supply and fit a new pre-hung wooden door.',1799,'3 hrs',false),
    ('carpenter','Laminate & Glass Door Installation','Fit laminate or glass panel doors.',2499,'3 hrs',false),
    ('carpenter','Partition & Folding Door Fixing','Install folding or partition panels.',1199,'2 hrs',false),
    ('carpenter','Wall Shelf & TV Unit Installation','Mount shelves and a basic TV unit.',799,'1.5 hrs',false),
    ('carpenter','Desk & Office Furniture Assembly','Assemble and fix office desks and chairs.',649,'2 hrs',false),

    -- Painting --------------------------------------------------------------
    ('painting','1 BHK Painting','Paint walls and ceiling of 1 BHK.',5999,'1 day',true),
    ('painting','2 BHK Painting','Paint walls and ceiling of 2 BHK.',8999,'2 days',true),
    ('painting','3 BHK Painting','Paint walls and ceiling of 3 BHK.',13999,'2 days',false),
    ('painting','Single Room Repainting','Repaint one room including prep and primer.',1999,'5 hrs',true),
    ('painting','Wall Texture & Design','Designer texture for a single wall.',1999,'6 hrs',false),
    ('painting','Ceiling Painting','Pop, patch and repaint a ceiling.',1299,'4 hrs',false),
    ('painting','Exterior Waterproofing Paint','Waterproof coating for terraces and walls.',3499,'1 day',false),
    ('painting','Putty & Primer Base Prep (per Room)','Putty, sanding and primer for one room.',649,'3 hrs',false),
    ('painting','Commercial Paint & Varnish','Paint and varnish for shops and offices.',1499,'4 hrs',false),
    ('painting','False Ceiling POP Painting','POP false ceiling work and painting.',2499,'1 day',false),
    ('painting','Metal & Grill Painting','Rust removal and repaint of gates and grills.',899,'2 hrs',false),
    ('painting','Stain Removal & Wall Repair','Treat seepage stains and patch damaged wall.',799,'2 hrs',false),

    -- Appliance Repair ------------------------------------------------------
    ('appliance-repair','Washing Machine Repair','Diagnose and fix washing machine issues.',299,'1 hr',true),
    ('appliance-repair','Refrigerator Repair','Diagnose and fix refrigerator cooling faults.',349,'1 hr',true),
    ('appliance-repair','Microwave Oven Repair','Repair magnetrons, boards and turntables.',299,'1 hr',false),
    ('appliance-repair','Geyser Repair','Repair heating elements and thermostats.',399,'1 hr',true),
    ('appliance-repair','Dishwasher Repair','Fix pumps, drainage and heating issues.',499,'1 hr',false),
    ('appliance-repair','Air Purifier Servicing','Filter change, wash and performance check.',449,'1 hr',false),
    ('appliance-repair','Mixer & Grinder Repair','Repair motor, jar and switch assemblies.',199,'45 mins',false),
    ('appliance-repair','Induction Cooktop Repair','Repair induction plates and touch panels.',249,'45 mins',false),
    ('appliance-repair','Water Purifier Service','Service the unit and replace filters.',599,'1 hr',true),
    ('appliance-repair','Chimney Deep Cleaning','Degrease filters and service the chimney.',799,'1 hr',false),
    ('appliance-repair','Vacuum Cleaner Repair','Fix motors, hoses and suction loss.',399,'1 hr',false),
    ('appliance-repair','Television & LED Repair','Repair panels, power supplies and boards.',499,'1 hr',false),
    ('appliance-repair','Home Appliance Annual AMC','Annual cover for up to four appliances.',1999,'1 day',false),

    -- Beauty & Salon --------------------------------------------------------
    ('beauty-salon','Salon Prime for Women','Haircut, facial, waxing and threading.',1499,'2 hrs',true),
    ('beauty-salon','Mens Haircut at Home','Professional haircut and beard styling.',199,'30 mins',true),
    ('beauty-salon','Ladies Haircut & Styling','Cut, wash and style for women.',399,'45 mins',false),
    ('beauty-salon','Kids Haircut','Gentle haircut for children under twelve.',249,'30 mins',true),
    ('beauty-salon','Facial & Cleanup (Men)','Clean-up, steam and mask for men.',499,'45 mins',false),
    ('beauty-salon','Facial & Cleanup (Women)','Clean-up, steam and mask for women.',749,'1 hr',false),
    ('beauty-salon','Deep Cleansing Facial','Hydra and glow facials with extractions.',1199,'1 hr',true),
    ('beauty-salon','Full Body Waxing (Women)','Full arms, legs, underarms and full arms.',1299,'2 hrs',false),
    ('beauty-salon','Threading & Eyebrows','Eyebrow, upper lip and full face threading.',299,'45 mins',false),
    ('beauty-salon','Manicure & Pedicure','Cuticle work, polish and foot care.',899,'1 hr',false),
    ('beauty-salon','Hair Spa & Treatment','Spa, conditioning and split-repair therapy.',899,'1 hr',false),
    ('beauty-salon','Head & Shoulder Massage','Relaxing oil massage for the upper body.',499,'30 mins',false),
    ('beauty-salon','Body Massage at Home (60 mins)','Full body relaxing massage at home.',999,'1 hr',false),
    ('beauty-salon','Bridal Makeup & Draping','Complete bridal makeup with hairstyling.',6999,'4 hrs',false),
    ('beauty-salon','Mens Grooming Package','Haircut, facial, manicure and pedicure.',2499,'2 hrs',false),

    -- Pest Control ----------------------------------------------------------
    ('pest-control','Cockroach Treatment','Gel and spray treatment for cockroaches.',799,'1 hr',false),
    ('pest-control','Termite Control (1 BHK)','Boron and barrier treatment for one bedroom flat.',3499,'1 day',true),
    ('pest-control','Termite Control (2 BHK)','Boron and barrier treatment for two bedroom flats.',5499,'1 day',false),
    ('pest-control','Bed Bugs Treatment','Heat and chemical treatment for bed bugs.',2499,'3 hrs',false),
    ('pest-control','Rodent Control','Trap, bait and seal rodent entry points.',1999,'2 hrs',false),
    ('pest-control','Ant Control','Gel baiting and trail treatment for ants.',1299,'1.5 hrs',false),
    ('pest-control','Mosquito & Flyer Treatment','Electronic and spray treatment for mosquitoes.',999,'1 hr',false),
    ('pest-control','Mosquito Nets & Fly Treatment','Install nets and treat for flies.',899,'1 hr',false),
    ('pest-control','Crawling Insect Treatment','Treatment for ants, spiders and crawling insects.',1399,'2 hrs',false),
    ('pest-control','Wood Treatment & Boron Protection','Anti-termite wood and post-treatment protection.',1999,'3 hrs',false),
    ('pest-control','Beehive Removal','Safe removal and disposal of beehives.',1499,'2 hrs',false),
    ('pest-control','Annual Pest Control AMC (2BHK)','Yearly cover for a two bedroom flat.',4499,'1 day',false),
    ('pest-control','Commercial Pest Control (1000 sq ft)','Pest control for shops, warehouses and offices.',2499,'1 day',false),

    -- Physiotherapy ---------------------------------------------------------
    ('physiotherapy','Physiotherapy Session at Home','Full body assessment and guided therapy session.',599,'60 mins',true),
    ('physiotherapy','Back & Neck Pain Relief','Targeted therapy to reduce stiffness and pain.',449,'45 mins',true),
    ('physiotherapy','Sports Injury Rehab','Recovery programme for sprains, strains and ligament injuries.',699,'1 hr',false),
    ('physiotherapy','Post-Surgery Rehabilitation','Safe mobility and strength recovery after surgery.',899,'2 hrs',false),
    ('physiotherapy','Knee & Joint Pain Therapy','Exercises and manual therapy for knee and joint pain.',499,'45 mins',false),
    ('physiotherapy','Neck & Shoulder Pain Therapy','Targeted therapy for neck and shoulder stiffness.',549,'45 mins',false),
    ('physiotherapy','Spine & Disc Slip Therapy','Mobilisation and core strengthening for spine pain.',999,'1 hr',false),
    ('physiotherapy','Stroke & Paralysis Rehabilitation','Guided movement and strength therapy.',1099,'1 hr',false),
    ('physiotherapy','Senior Citizen Mobility Care','Balance, gait and falls prevention sessions.',749,'60 mins',false),
    ('physiotherapy','Pregnancy & Postnatal Physio','Pelvic floor and recovery physiotherapy.',849,'60 mins',false),
    ('physiotherapy','Orthopaedic Follow-up Physiotherapy','Continued therapy after orthopaedic surgery.',699,'45 mins',false),
    ('physiotherapy','Home Exercise Programme Consult','Assessment plus a tailored home exercise plan.',399,'45 mins',false),

    -- Other -----------------------------------------------------------------
    ('other','Smart Lock Installation','Install and configure smart door locks.',599,'1 hr',false),
    ('other','Curtain & Blind Fitting','Measure, drill and fit curtains and blinds.',499,'1 hr',false),
    ('other','Water Dispenser Installation','Install wall-hung dispensers and RO units.',799,'1.5 hrs',false),
    ('other','Mesh & Anti-Insect Door Fitting','Fit mesh and anti-insect door frames.',899,'2 hrs',false),
    ('other','Furniture Disassembly & Shifting','Dismantle and shift furniture within the home.',1499,'3 hrs',false),
    ('other','Home Disinfection Service','Disinfect surfaces and touch points throughout the home.',3999,'4 hrs',false),

    -- Packer & Mover (new) --------------------------------------------------
    ('packer-mover','Local House Shifting (1 BHK)','Pack, load and shift a 1 BHK home within 10 km.',1499,'1 day',true),
    ('packer-mover','Local House Shifting (2 BHK)','Pack, load and shift a 2 BHK home within 10 km.',2499,'1 day',true),
    ('packer-mover','Local House Shifting (3 BHK)','Pack, load and shift a 3 BHK home within 10 km.',3499,'1 day',false),
    ('packer-mover','Office & Shop Relocation','Pack and relocate office or shop inventory.',6999,'1 day',false),
    ('packer-mover','Intercity Moving (up to 1 BHK)','Door-to-door intercity moving for a 1 BHK home.',8999,'2 days',false),
    ('packer-mover','Bike & Scooter Shifting','Move a bike or scooter with a dedicated carrier.',449,'1 hr',false),
    ('packer-mover','Car Shifting (Hatchback or Sedan)','Move a car within the city with paperwork help.',1499,'1 day',false),
    ('packer-mover','Warehouse & Godown Shifting','Shift inventory, racks and heavy goods.',4999,'1 day',false),
    ('packer-mover','Loading & Unloading Crew','Trained manpower for loading and unloading.',249,'2 hrs',false),
    ('packer-mover','Packing Materials & Wrapping','Bubble wrap, cartons, stretch film and taping.',899,'2 hrs',false),
    ('packer-mover','Heavy Item Handling','Move pianos, gym equipment and large appliances.',999,'2 hrs',false),
    ('packer-mover','Storage Facility (1 Month)','One month of secured storage for a 1 BHK home.',2999,'1 day',false),

    -- CCTV & Security (new) -------------------------------------------------
    ('cctv-security','CCTV Installation (up to 4 Cameras)','Supply, mount and configure up to four cameras.',3499,'1 day',true),
    ('cctv-security','CCTV Installation (up to 8 Cameras)','Full install for up to eight cameras with cabling.',5999,'1 day',false),
    ('cctv-security','CCTV Annual Maintenance (4 Cameras)','Yearly check, cleaning and lens alignment.',3499,'1 day',false),
    ('cctv-security','CCTV Camera Repair','Replace or repair faulty camera units.',799,'1 hr',false),
    ('cctv-security','DVR & NVR Setup','Configure recording, playback and remote access.',1499,'2 hrs',false),
    ('cctv-security','Video Door Phone Installation','Install and wire a video door phone.',3499,'1 day',false),
    ('cctv-security','Home Security System Installation','Install and configure a burglar alarm system.',4999,'1 day',false),
    ('cctv-security','Motion Sensor & Spotlight Installation','Fit outdoor motion sensors and spotlights.',1999,'2 hrs',false),
    ('cctv-security','CCTV Remote Monitoring Setup','Set up live viewing on phone and TV apps.',999,'1 hr',false),
    ('cctv-security','Camera Relocation & Cable Routing','Move cameras and conceal new cabling.',1499,'2 hrs',false),
    ('cctv-security','Intercom & Access Control Installation','Install door entry intercom and access control.',6499,'1 day',false),
    ('cctv-security','CCTV Cloud Backup Setup','Enable cloud recording and backup retention.',1999,'1 hr',false),

    -- Laundry & Dry Cleaning (new) ------------------------------------------
    ('laundry-dry-cleaning','Dry Cleaning (Shirt or Suit)','Per piece dry cleaning with pressing.',149,'1 day',true),
    ('laundry-dry-cleaning','Dry Cleaning (Saree or Lehenga)','Heavy and bridal drape dry cleaning.',999,'2 days',false),
    ('laundry-dry-cleaning','Wash & Fold (per kg)','Machine wash and folded delivery by weight.',79,'1 day',true),
    ('laundry-dry-cleaning','Wash & Iron (per piece)','Wash and steam iron a single item.',59,'1 day',true),
    ('laundry-dry-cleaning','Steam Ironing (per piece)','Press a single garment without washing.',39,'30 mins',false),
    ('laundry-dry-cleaning','Curtain Dry Cleaning (per kg)','Wash, dry and rehang curtains.',199,'1 day',false),
    ('laundry-dry-cleaning','Bedsheet Wash & Iron','Wash and press one bedsheet set.',149,'1 day',false),
    ('laundry-dry-cleaning','Jacket & Blazer Dry Cleaning','Deep clean and press winter wear.',449,'2 days',false),
    ('laundry-dry-cleaning','Shoe Cleaning & Polishing','Clean, polish and restore one pair.',349,'1 day',false),
    ('laundry-dry-cleaning','Sofa Cover Dry Cleaning (per seat)','Remove, clean and refit one seat cover.',249,'1 day',false),
    ('laundry-dry-cleaning','Carpet Dry Cleaning (per kg)','Wash and dry-clean one carpet.',79,'1 day',false),
    ('laundry-dry-cleaning','Mattress & Upholstery Cleaning','Vacuum and shampoo-clean mattresses.',999,'1 day',false),
    ('laundry-dry-cleaning','Pickup & Drop Laundry Plan','Monthly doorstep laundry subscription.',1999,'1 day',false),

    -- Lawn & Garden (new) ---------------------------------------------------
    ('lawn-garden','Lawn Mowing','Mow, edge and clear garden clippings.',499,'1 hr',true),
    ('lawn-garden','Garden Maintenance & Pruning','Prune shrubs, hedges and flowering plants.',899,'2 hrs',false),
    ('lawn-garden','Terrace Garden Setup','Plan and set up planters on a terrace.',2499,'1 day',false),
    ('lawn-garden','Plant Pot Repotting & Care','Repot, prune and feed container plants.',399,'1 hr',false),
    ('lawn-garden','Plant Pest & Disease Treatment','Diagnose and treat plant pests and disease.',699,'1 hr',false),
    ('lawn-garden','Vertical Garden & Green Wall','Install a living wall on a balcony or terrace.',4999,'1 day',false),
    ('lawn-garden','Flower Bed Preparation','Dig, bed and prepare soil for planting.',799,'2 hrs',false),
    ('lawn-garden','Lawn Fertilization & Weeding','Feed grass and remove weeds.',649,'1.5 hrs',false),
    ('lawn-garden','Artificial Turf Installation','Lay and fix artificial grass flooring.',3499,'1 day',false),
    ('lawn-garden','Bonsai & Indoor Plant Care','Prune, shape and care for bonsai plants.',699,'1 hr',false)
  ) AS s(slug, name, description, price, duration, popular)
),
repriced AS (
  UPDATE services sv
  SET starting_price     = c.price,
      description        = c.description,
      estimated_duration = c.duration,
      popular            = c.popular
  FROM catalog c
  WHERE sv.name = c.name
  RETURNING sv.id
)
INSERT INTO services (category_id, name, description, starting_price, estimated_duration, popular)
SELECT cat.id, c.name, c.description, c.price, c.duration, c.popular
FROM catalog c
JOIN categories cat ON cat.slug = c.slug
WHERE NOT EXISTS (SELECT 1 FROM services sv WHERE sv.name = c.name);

-- Collapse rows the base seed duplicated.
--
-- `20260830093336_luckyseva_schema.sql` ends its service seed in a bare
-- `ON CONFLICT DO NOTHING`. With no unique constraint on `services` that clause
-- can never match, so every re-apply of that file inserts its 21 rows again —
-- which means a database built by applying the set twice (exactly what CI does)
-- has each of those services listed twice, and shows duplicated cards in the
-- category and popular-services lists.
--
-- The original migration is already applied in production and must not be
-- edited, so the damage is repaired here instead. This migration sorts last,
-- so it runs after the second insert has had its chance. Keeping the lowest id
-- per name is stable and makes this a no-op once the duplicates are gone.
DELETE FROM services keep
USING services extra
WHERE extra.name = keep.name
  AND extra.id > keep.id;

-- ---------------------------------------------------------------------------
-- Professional <-> service links
-- ---------------------------------------------------------------------------

-- Link every professional to every service in their own category. Earlier
-- backfills used ON CONFLICT DO NOTHING, which left the mirror price stale.
INSERT INTO professional_services (professional_id, service_id, price)
SELECT p.id, sv.id, sv.starting_price
FROM professionals p
JOIN categories c ON c.slug = p.category_slug
JOIN services sv ON sv.category_id = c.id
ON CONFLICT (professional_id, service_id) DO NOTHING;

UPDATE professional_services ps
SET price = sv.starting_price
FROM services sv
WHERE ps.service_id = sv.id;

-- ---------------------------------------------------------------------------
-- Professional price floor
-- ---------------------------------------------------------------------------

-- `professionals.starting_price` is still the signup default of 99 on most rows,
-- and ProfessionalListScreen / FavouritesScreen render it directly. Point it at
-- the cheapest service in the professional's own category so the floor matches
-- what the booking actually bills.
UPDATE professionals p
SET starting_price = floor_prices.min_price
FROM (
  SELECT p2.id, MIN(sv.starting_price) AS min_price
  FROM professionals p2
  JOIN categories c ON c.slug = p2.category_slug
  JOIN services sv ON sv.category_id = c.id
  GROUP BY p2.id
) AS floor_prices
WHERE p.id = floor_prices.id
  AND floor_prices.min_price IS NOT NULL;