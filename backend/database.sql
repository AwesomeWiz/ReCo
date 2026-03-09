DROP DATABASE IF EXISTS reco;
CREATE DATABASE reco;
USE reco;

CREATE TABLE shops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_name VARCHAR(255),
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    country VARCHAR(100),
    state VARCHAR(100),
    district VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    shop_id INT NOT NULL,
    transaction_code VARCHAR(20) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status ENUM('active','completed') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX (shop_id),
    FOREIGN KEY (shop_id) REFERENCES shops(id)
) ENGINE=InnoDB;

CREATE TABLE sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  transaction_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  INDEX (transaction_id)
);

CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shop_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    barcode VARCHAR(50),                          -- remove UNIQUE here
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    UNIQUE KEY barcode_per_shop (shop_id, barcode) -- unique per shop instead
);

-- Insert shop (id=1)
INSERT INTO shops (id, store_name, phone, password_hash, country, state, district) VALUES 
(1, 'Test Store', '9999999999', '$2b$12$T36YDUZ6Tdnu9GlcJU/KeOOgtB218HTCEO0OC7rmbQ1TMDR/0ROzK', 'India', 'Kerala', 'Ernakulam');

-- ═══════════════════════════════════════════════
-- 25 transactions spanning Jan 10 – Feb 19, 2026
-- ═══════════════════════════════════════════════
INSERT INTO transactions (shop_id, transaction_code, total, created_at, status) VALUES
(1, 'TXN101', 1295, '2026-01-10 09:15:00', 'completed'),
(1, 'TXN102',  785, '2026-01-12 11:30:00', 'completed'),
(1, 'TXN103', 1670, '2026-01-14 10:00:00', 'completed'),
(1, 'TXN104',  940, '2026-01-16 14:20:00', 'completed'),
(1, 'TXN105', 1425, '2026-01-18 09:45:00', 'completed'),
(1, 'TXN106', 1100, '2026-01-20 16:10:00', 'completed'),
(1, 'TXN107',  860, '2026-01-22 12:30:00', 'completed'),
(1, 'TXN108', 1530, '2026-01-24 10:55:00', 'completed'),
(1, 'TXN109', 1180, '2026-01-26 15:40:00', 'completed'),
(1, 'TXN110',  720, '2026-01-27 11:00:00', 'completed'),
(1, 'TXN111', 1340, '2026-01-28 09:20:00', 'completed'),
(1, 'TXN112', 1610, '2026-01-29 13:45:00', 'completed'),
(1, 'TXN113',  950, '2026-01-30 17:00:00', 'completed'),
(1, 'TXN114', 1275, '2026-01-31 10:30:00', 'completed'),
(1, 'TXN115', 1480, '2026-02-01 14:15:00', 'completed'),
(1, 'TXN116',  890, '2026-02-03 09:50:00', 'completed'),
(1, 'TXN117', 1560, '2026-02-05 11:20:00', 'completed'),
(1, 'TXN118', 1050, '2026-02-07 16:30:00', 'completed'),
(1, 'TXN119', 1380, '2026-02-09 10:10:00', 'completed'),
(1, 'TXN120',  770, '2026-02-11 12:45:00', 'completed'),
(1, 'TXN121', 1420, '2026-02-13 09:30:00', 'completed'),
(1, 'TXN122', 1150, '2026-02-15 15:00:00', 'completed'),
(1, 'TXN123', 1690, '2026-02-17 10:40:00', 'completed'),
(1, 'TXN124',  980, '2026-02-18 14:05:00', 'completed'),
(1, 'TXN125', 1310, '2026-02-19 09:00:00', 'completed');

-- ═══════════════════════════════════════════════
-- Sales using REAL products from labelMapping.json
-- ═══════════════════════════════════════════════
INSERT INTO sales (shop_id, transaction_id, product_name, category, price, quantity, total, created_at) VALUES
-- TXN101 (Jan 10)
(1, 1, 'Coca-Cola-600 ml-',                       'Beverages',       40,  5,  200, '2026-01-10 09:15:00'),
(1, 1, 'Maggi 2-Minute Masala Instant Noodles 280 g','Noodles',      45,  6,  270, '2026-01-10 09:18:00'),
(1, 1, 'Brooke Bond Red Label Leaf Tea 500 g',     'Tea & Coffee',   280, 1,  280, '2026-01-10 09:20:00'),
(1, 1, 'Tata Salt Vacuum Evaporated Iodised Salt  1 kg Pouch','Groceries',25,3,75,'2026-01-10 09:22:00'),
(1, 1, 'Parachute Coconut Oil 300 ml',             'Personal Care',  170, 1,  170, '2026-01-10 09:25:00'),
(1, 1, 'Bisleri Packaged Drinking Water 500 ml',   'Beverages',       20, 15, 300, '2026-01-10 09:27:00'),

-- TXN102 (Jan 12)
(1, 2, 'Nescafe Classic Instant Coffee 90 g',      'Tea & Coffee',   220, 1,  220, '2026-01-12 11:30:00'),
(1, 2, 'Dettol Bathing Soap Bar - Original 125g',  'Personal Care',   45, 3,  135, '2026-01-12 11:33:00'),
(1, 2, 'Appy Fizz Apple Juice -250 ml-',           'Beverages',       30, 4,  120, '2026-01-12 11:35:00'),
(1, 2, 'Everest Chicken Masala 100 g',             'Spices & Masala',  65, 2,  130, '2026-01-12 11:37:00'),
(1, 2, 'MAGGI Pichkoo - Rich Tomato Ketchup 80 g Pouch','Sauces',    30, 6,  180, '2026-01-12 11:39:00'),

-- TXN103 (Jan 14)
(1, 3, 'Fortune Sunlite Refined Sunflower Oil 5 L','Cooking Oil',    750, 1,  750, '2026-01-14 10:00:00'),
(1, 3, 'Coca-Cola-1 liter-',                       'Beverages',       65, 4,  260, '2026-01-14 10:05:00'),
(1, 3, 'Cadbury Bournvita Chocolate Health Drink-1kg-','Health Drinks',480,1, 480, '2026-01-14 10:08:00'),
(1, 3, 'Exo Touch - Shine Anti-Bacterial Round Dishwash Bar 500 g','Cleaning',48,2,96,'2026-01-14 10:10:00'),
(1, 3, 'Catch Amchur Powder 100 g',                'Spices & Masala',  42, 2,  84, '2026-01-14 10:12:00'),

-- TXN104 (Jan 16)
(1, 4, 'Gokul Milk 500ml',                         'Dairy',           28, 8,  224, '2026-01-16 14:20:00'),
(1, 4, 'Maggi 2-Minute Masala Instant Noodles 420 g','Noodles',       65, 4,  260, '2026-01-16 14:23:00'),
(1, 4, 'Bisleri Packaged Drinking Water 250 ml',   'Beverages',       10, 20, 200, '2026-01-16 14:25:00'),
(1, 4, 'Mysore Sandal Soap 125 g',                 'Personal Care',   48, 3,  144, '2026-01-16 14:28:00'),
(1, 4, 'LG Compounded Hing 100 g',                 'Spices & Masala', 112, 1,  112, '2026-01-16 14:30:00'),

-- TXN105 (Jan 18)
(1, 5, 'Amul Ice Cream - Vanilla Magic 1 L Tub',   'Dairy',          280, 2,  560, '2026-01-18 09:45:00'),
(1, 5, 'Tropicana Fruit Juice - Delight Guava1 L', 'Beverages',       99, 3,  297, '2026-01-18 09:48:00'),
(1, 5, 'Chings Secret Veg Hakka Noodles 140 g Pouch','Noodles',       30, 6,  180, '2026-01-18 09:50:00'),
(1, 5, 'Nivea Fresh Natural Deodorant 150 ml',     'Personal Care',  194, 2,  388, '2026-01-18 09:53:00'),

-- TXN106 (Jan 20)
(1, 6, 'Coca-Cola-600 ml-',                        'Beverages',       40, 8,  320, '2026-01-20 16:10:00'),
(1, 6, 'Govardhan Pure cow Ghee -1kg-',            'Dairy',          520, 1,  520, '2026-01-20 16:13:00'),
(1, 6, 'Everest Pav Bhaji Masala 100 g',           'Spices & Masala',  65, 4,  260, '2026-01-20 16:15:00'),

-- TXN107 (Jan 22)
(1, 7, 'Nescafe Classic Instant Coffee 24 g',      'Tea & Coffee',    65, 4,  260, '2026-01-22 12:30:00'),
(1, 7, 'Dettol Original Instant Hand Sanitizer 50 ml','Personal Care',35, 6,  210, '2026-01-22 12:33:00'),
(1, 7, 'Sunfeast Yippee Noodlemagic Masala 360 g', 'Noodles',         55, 3,  165, '2026-01-22 12:35:00'),
(1, 7, 'Kinley Packaged Drinking Water 500 ml',    'Beverages',       20, 8,  160, '2026-01-22 12:38:00'),
(1, 7, 'Catch Ginger Garlic Paste 200 g',          'Spices & Masala',  55, 1,   55, '2026-01-22 12:40:00'),

-- TXN108 (Jan 24)
(1, 8, 'Brooke Bond Red Label Leaf Tea 500 g',     'Tea & Coffee',   280, 2,  560, '2026-01-24 10:55:00'),
(1, 8, 'Parachute Coconut Oil 600 ml - Bottle',    'Personal Care',  310, 1,  310, '2026-01-24 10:58:00'),
(1, 8, 'Maggi 2-Minute Masala Instant Noodles 280 g','Noodles',       45, 8,  360, '2026-01-24 11:00:00'),
(1, 8, 'Bisleri Packaged Drinking Water 500 ml',   'Beverages',       20, 15, 300, '2026-01-24 11:03:00'),

-- TXN109 (Jan 26)
(1, 9, 'Coca-Cola-1 liter-',                       'Beverages',       65, 6,  390, '2026-01-26 15:40:00'),
(1, 9, 'Gokul Milk 500ml',                         'Dairy',           28, 10, 280, '2026-01-26 15:43:00'),
(1, 9, 'Ching-s secret schezwan fried masala',      'Spices & Masala',  45, 4,  180, '2026-01-26 15:45:00'),
(1, 9, 'Good Knight Activ- Lavender Mosquito Repellent Refill 45 ml','Household',75,2,150,'2026-01-26 15:48:00'),
(1, 9, 'MAGGI Pichkoo - Rich Tomato Ketchup 80 g Pouch','Sauces',    30, 6,  180, '2026-01-26 15:50:00'),

-- TXN110 (Jan 27)
(1, 10, 'Bisleri Club Soda - 750 ml',              'Beverages',       20, 10, 200, '2026-01-27 11:00:00'),
(1, 10, 'Knorr Pizza Pasta Sauce',                 'Sauces',          99,  2, 198, '2026-01-27 11:03:00'),
(1, 10, 'Tata Salt Vacuum Evaporated Iodised Salt  1 kg Pouch','Groceries',25,5,125,'2026-01-27 11:05:00'),
(1, 10, 'Patanjali Neem Kanti Body Cleanser 75 g', 'Personal Care',   22, 4,  88,  '2026-01-27 11:08:00'),

-- TXN111 (Jan 28)
(1, 11, 'Maggi 2-Minute Masala Instant Noodles 280 g','Noodles',      45, 10, 450, '2026-01-28 09:20:00'),
(1, 11, 'Coca-Cola-600 ml-',                       'Beverages',       40, 10, 400, '2026-01-28 09:23:00'),
(1, 11, 'Everest Chaat Masala 50 g',               'Spices & Masala',  38,  4, 152, '2026-01-28 09:25:00'),
(1, 11, 'Society Leaf Tea 250g Jar',               'Tea & Coffee',    169, 2, 338, '2026-01-28 09:28:00'),

-- TXN112 (Jan 29)
(1, 12, 'Fortune Sunlite Refined Sunflower Oil 5 L','Cooking Oil',   750, 1,  750, '2026-01-29 13:45:00'),
(1, 12, 'Cadbury Bournvita Chocolate Health Drink-1kg-','Health Drinks',480,1,480,'2026-01-29 13:48:00'),
(1, 12, 'Fogg Napoleon Fragrance Body Spray 150 ml','Personal Care',  190, 2, 380, '2026-01-29 13:50:00'),

-- TXN113 (Jan 30)
(1, 13, 'Gokul Milk 500ml',                        'Dairy',           28, 12, 336, '2026-01-30 17:00:00'),
(1, 13, 'Bisleri Packaged Drinking Water 500 ml',  'Beverages',       20, 12, 240, '2026-01-30 17:03:00'),
(1, 13, 'Dettol Bathing Soap Bar - Original 125g', 'Personal Care',   45,  4, 180, '2026-01-30 17:05:00'),
(1, 13, 'Vandevi Bandhani No 1 Hing Powder 50 g',  'Spices & Masala',  48,  4, 192, '2026-01-30 17:08:00'),

-- TXN114 (Jan 31)
(1, 14, 'Nescafe Classic Instant Coffee 90 g',     'Tea & Coffee',   220, 2,  440, '2026-01-31 10:30:00'),
(1, 14, 'Tropicana Fruit Juice - Delight Guava1 L','Beverages',       99, 3,  297, '2026-01-31 10:33:00'),
(1, 14, 'Maggi 2-Minute Masala Instant Noodles 420 g','Noodles',      65, 4,  260, '2026-01-31 10:35:00'),
(1, 14, 'Baygon Mosquito - Fly Killer Spray 625 ml','Household',     278, 1,  278, '2026-01-31 10:38:00'),

-- TXN115 (Feb 1)
(1, 15, 'Coca-Cola-600 ml-',                       'Beverages',       40, 12, 480, '2026-02-01 14:15:00'),
(1, 15, 'Amul Ice Cream - Vanilla Magic 1 L Tub',  'Dairy',          280, 2,  560, '2026-02-01 14:18:00'),
(1, 15, 'Exo Touch - Shine Anti-Bacterial Round Dishwash Bar 700 g','Cleaning',65,2,130,'2026-02-01 14:20:00'),
(1, 15, 'LG Compounded Hing Powder 50 g',          'Spices & Masala',  62, 5, 310, '2026-02-01 14:23:00'),

-- TXN116 (Feb 3)
(1, 16, 'Bisleri Packaged Drinking Water 500 ml',  'Beverages',       20, 10, 200, '2026-02-03 09:50:00'),
(1, 16, 'Gokul Milk 500ml',                        'Dairy',           28, 10, 280, '2026-02-03 09:53:00'),
(1, 16, 'Maggi 2-Minute Masala Instant Noodles 280 g','Noodles',      45,  6, 270, '2026-02-03 09:55:00'),
(1, 16, 'Mysore Sandal Soap 150 g -Pack of 3-',    'Personal Care',   140, 1, 140, '2026-02-03 09:58:00'),

-- TXN117 (Feb 5)
(1, 17, 'Brooke Bond Red Label Leaf Tea 500 g',    'Tea & Coffee',   280, 2,  560, '2026-02-05 11:20:00'),
(1, 17, 'Coca-Cola-1 liter-',                      'Beverages',       65, 6,  390, '2026-02-05 11:23:00'),
(1, 17, 'Govardhan Pure cow Ghee -200ml-',         'Dairy',          130, 2,  260, '2026-02-05 11:25:00'),
(1, 17, 'Pintola High Protein Peanut Butter-510 gm-','Health Drinks',350, 1,  350, '2026-02-05 11:28:00'),

-- TXN118 (Feb 7)
(1, 18, 'Nescafe Classic Instant Coffee 24 g',     'Tea & Coffee',    65, 4,  260, '2026-02-07 16:30:00'),
(1, 18, 'Dettol Original Instant Hand Sanitizer 50 ml','Personal Care',35,6, 210, '2026-02-07 16:33:00'),
(1, 18, 'HERSHEY-S Chocolate Flavored Syrup 200g', 'Sauces',         160, 1,  160, '2026-02-07 16:35:00'),
(1, 18, 'Sunfeast Yippee Noodlemagic Masala 360 g','Noodles',         55, 4,  220, '2026-02-07 16:38:00'),
(1, 18, 'Organic India Tulsi Green Tea 100 g',     'Tea & Coffee',   200, 1,  200, '2026-02-07 16:40:00'),

-- TXN119 (Feb 9)
(1, 19, 'Coca-Cola-600 ml-',                       'Beverages',       40, 10, 400, '2026-02-09 10:10:00'),
(1, 19, 'Maggi 2-Minute Masala Instant Noodles 280 g','Noodles',      45, 8,  360, '2026-02-09 10:13:00'),
(1, 19, 'Parachute Coconut Oil 300 ml',            'Personal Care',  170, 2,  340, '2026-02-09 10:15:00'),
(1, 19, 'Everest Chicken Masala 50 g',             'Spices & Masala',  35, 4,  140, '2026-02-09 10:18:00'),
(1, 19, 'Kimia Dates',                             'Groceries',       140, 1,  140, '2026-02-09 10:20:00'),

-- TXN120 (Feb 11)
(1, 20, 'Bisleri Packaged Drinking Water 500 ml',  'Beverages',       20, 10, 200, '2026-02-11 12:45:00'),
(1, 20, 'Gokul Milk 500ml',                        'Dairy',           28,  8, 224, '2026-02-11 12:48:00'),
(1, 20, 'MAGGI Pichkoo - Rich Tomato Ketchup 80 g Pouch','Sauces',   30, 4,  120, '2026-02-11 12:50:00'),
(1, 20, 'Badshah Afgani Hing',                     'Spices & Masala', 110, 1,  110, '2026-02-11 12:53:00'),
(1, 20, 'Gold Oil',                                'Cooking Oil',     115, 1,  115, '2026-02-11 12:55:00'),

-- TXN121 (Feb 13)
(1, 21, 'Maggi 2-Minute Masala Instant Noodles 280 g','Noodles',      45, 10, 450, '2026-02-13 09:30:00'),
(1, 21, 'Coca-Cola-1 liter-',                      'Beverages',       65,  5, 325, '2026-02-13 09:33:00'),
(1, 21, 'Nescafe Classic Instant Coffee 90 g',     'Tea & Coffee',   220,  1, 220, '2026-02-13 09:35:00'),
(1, 21, 'HIT Mosquito - Fly Killer Spray700 ml',   'Household',      295,  1, 295, '2026-02-13 09:38:00'),
(1, 21, 'Pond-s Dreamflower Pink Lily Fragrant Talc 400 g','Personal Care',215,1,215,'2026-02-13 09:40:00'),

-- TXN122 (Feb 15)
(1, 22, 'Gokul Milk 500ml',                        'Dairy',           28, 10, 280, '2026-02-15 15:00:00'),
(1, 22, 'Bisleri Packaged Drinking Water 500 ml',  'Beverages',       20, 15, 300, '2026-02-15 15:03:00'),
(1, 22, 'Tata Salt Vacuum Evaporated Iodised Salt  1 kg Pouch','Groceries',25,4,100,'2026-02-15 15:05:00'),
(1, 22, 'Smith - Jones Ginger Garlic Paste 200 g', 'Spices & Masala',  55, 2, 110, '2026-02-15 15:08:00'),
(1, 22, 'Chings Secret Veg Hakka Noodles 140 g Pouch','Noodles',      30, 6, 180, '2026-02-15 15:10:00'),
(1, 22, 'Dettol Bathing Soap Bar - Original 125g', 'Personal Care',   45, 4, 180, '2026-02-15 15:13:00'),

-- TXN123 (Feb 17)
(1, 23, 'Fortune Sunlite Refined Sunflower Oil 5 L','Cooking Oil',   750, 1,  750, '2026-02-17 10:40:00'),
(1, 23, 'Coca-Cola-600 ml-',                       'Beverages',       40, 8,  320, '2026-02-17 10:43:00'),
(1, 23, 'Brooke Bond Red Label Leaf Tea 500 g',    'Tea & Coffee',   280, 1,  280, '2026-02-17 10:45:00'),
(1, 23, 'Godrej Aer Lush Green Fresh Home Fragrance Spray 220 ml','Household',170,1,170,'2026-02-17 10:48:00'),
(1, 23, 'Everest Pav Bhaji Masala 100 g',          'Spices & Masala',  65, 2, 130, '2026-02-17 10:50:00'),

-- TXN124 (Feb 18)
(1, 24, 'Maggi 2-Minute Masala Instant Noodles 280 g','Noodles',      45, 6,  270, '2026-02-18 14:05:00'),
(1, 24, 'Bisleri Packaged Drinking Water 500 ml',  'Beverages',       20, 10, 200, '2026-02-18 14:08:00'),
(1, 24, 'Nescafe Classic Instant Coffee 24 g',     'Tea & Coffee',    65, 2,  130, '2026-02-18 14:10:00'),
(1, 24, 'Gokul Milk 500ml',                        'Dairy',           28, 6,  168, '2026-02-18 14:13:00'),
(1, 24, 'Everest Chicken Masala 100 g',            'Spices & Masala',  65, 2,  130, '2026-02-18 14:15:00'),

-- TXN125 (Feb 19 — today)
(1, 25, 'Coca-Cola-600 ml-',                       'Beverages',       40, 10, 400, '2026-02-19 09:00:00'),
(1, 25, 'Maggi 2-Minute Masala Instant Noodles 280 g','Noodles',      45, 8,  360, '2026-02-19 09:03:00'),
(1, 25, 'Gokul Milk 500ml',                        'Dairy',           28, 8,  224, '2026-02-19 09:05:00'),
(1, 25, 'Dettol Bathing Soap Bar - Original 125g', 'Personal Care',   45, 3,  135, '2026-02-19 09:08:00'),
(1, 25, 'Tata Salt Vacuum Evaporated Iodised Salt  1 kg Pouch','Groceries',25,4,100,'2026-02-19 09:10:00'),
(1, 25, 'Nescafe Classic Instant Coffee 90 g',     'Tea & Coffee',    91, 1,   91, '2026-02-19 09:12:00');

-- ═══════════════════════════════════════════════
-- Inventory — top-selling products from labelMapping
-- ═══════════════════════════════════════════════
INSERT INTO inventory (shop_id, product_name, category, price, stock, barcode) VALUES
(1, 'Coca-Cola-600 ml-',                            'Beverages',       40,  18, 'BAR001'),
(1, 'Maggi 2-Minute Masala Instant Noodles 280 g',  'Noodles',         45,  12, 'BAR002'),
(1, 'Bisleri Packaged Drinking Water 500 ml',       'Beverages',       20,  30, 'BAR003'),
(1, 'Gokul Milk 500ml',                             'Dairy',           28,   8, 'BAR004'),
(1, 'Brooke Bond Red Label Leaf Tea 500 g',         'Tea & Coffee',   280,   5, 'BAR005'),
(1, 'Nescafe Classic Instant Coffee 90 g',          'Tea & Coffee',   220,   4, 'BAR006'),
(1, 'Dettol Bathing Soap Bar - Original 125g',      'Personal Care',   45,  10, 'BAR007'),
(1, 'Coca-Cola-1 liter-',                           'Beverages',       65,   8, 'BAR008'),
(1, 'Parachute Coconut Oil 300 ml',                 'Personal Care',  170,   3, 'BAR009'),
(1, 'Fortune Sunlite Refined Sunflower Oil 5 L',    'Cooking Oil',    750,   2, 'BAR010'),
(1, 'Everest Chicken Masala 100 g',                 'Spices & Masala',  65,   6, 'BAR011'),
(1, 'MAGGI Pichkoo - Rich Tomato Ketchup 80 g Pouch','Sauces',        30,  10, 'BAR012'),
(1, 'Tata Salt Vacuum Evaporated Iodised Salt  1 kg Pouch','Groceries',25,  15, 'BAR013'),
(1, 'Tropicana Fruit Juice - Delight Guava1 L',     'Beverages',       99,   4, 'BAR014'),
(1, 'Amul Ice Cream - Vanilla Magic 1 L Tub',       'Dairy',          280,   3, 'BAR015');
