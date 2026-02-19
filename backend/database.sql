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
    barcode VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- Insert dummy shop (id=1)
INSERT INTO shops (id, store_name, phone, password_hash, country, state) VALUES 
(1, 'Test Store', '9999999999', '$2b$12$T36YDUZ6Tdnu9GlcJU/KeOOgtB218HTCEO0OC7rmbQ1TMDR/0ROzK', 'India', 'Kerala');

-- Insert transactions (20 completed, spanning Jan 15 – Feb 3, 2026)
INSERT INTO transactions (shop_id, transaction_code, total, created_at, status)
VALUES
(1, 'TXN101', 800,  '2026-01-15 10:00:00', 'completed'),
(1, 'TXN102', 1200, '2026-01-16 11:00:00', 'completed'),
(1, 'TXN103', 900,  '2026-01-17 12:00:00', 'completed'),
(1, 'TXN104', 1500, '2026-01-18 09:30:00', 'completed'),
(1, 'TXN105', 1100, '2026-01-19 15:45:00', 'completed'),
(1, 'TXN106', 700,  '2026-01-20 13:10:00', 'completed'),
(1, 'TXN107', 1300, '2026-01-21 17:20:00', 'completed'),
(1, 'TXN108', 950,  '2026-01-22 14:50:00', 'completed'),
(1, 'TXN109', 1600, '2026-01-23 18:30:00', 'completed'),
(1, 'TXN110', 1250, '2026-01-24 12:15:00', 'completed'),
(1, 'TXN111', 1050, '2026-01-25 10:40:00', 'completed'),
(1, 'TXN112', 1700, '2026-01-26 16:00:00', 'completed'),
(1, 'TXN113', 980,  '2026-01-27 11:30:00', 'completed'),
(1, 'TXN114', 1400, '2026-01-28 09:20:00', 'completed'),
(1, 'TXN115', 1150, '2026-01-29 14:10:00', 'completed'),
(1, 'TXN116', 1350, '2026-01-30 13:00:00', 'completed'),
(1, 'TXN117', 900,  '2026-01-31 15:45:00', 'completed'),
(1, 'TXN118', 1500, '2026-02-01 10:00:00', 'completed'),
(1, 'TXN119', 1250, '2026-02-02 11:10:00', 'completed'),
(1, 'TXN120', 1600, '2026-02-03 12:20:00', 'completed');

-- Populate sales data with specific products and categories
INSERT INTO sales (shop_id, transaction_id, product_name, category, price, quantity, total, created_at)
VALUES
(1, 1, 'Milk',   'Dairy',     50,  8,  400,  '2026-01-15 10:00:00'),
(1, 1, 'Bread',  'Bakery',    40,  10, 400,  '2026-01-15 10:05:00'),
(1, 2, 'Rice',   'Groceries', 60,  10, 600,  '2026-01-16 11:00:00'),
(1, 2, 'Sugar',  'Groceries', 50,  12, 600,  '2026-01-16 11:05:00'),
(1, 3, 'Eggs',   'Dairy',     10,  30, 300,  '2026-01-17 12:00:00'),
(1, 3, 'Bread',  'Bakery',    40,  15, 600,  '2026-01-17 12:05:00'),
(1, 4, 'Milk',   'Dairy',     50,  15, 750,  '2026-01-18 09:30:00'),
(1, 4, 'Rice',   'Groceries', 60,  12, 720,  '2026-01-18 09:35:00'),
(1, 5, 'Sugar',  'Groceries', 50,  10, 500,  '2026-01-19 15:45:00'),
(1, 5, 'Eggs',   'Dairy',     10,  60, 600,  '2026-01-19 15:50:00'),
(1, 6, 'Bread',  'Bakery',    40,  10, 400,  '2026-01-20 13:10:00'),
(1, 6, 'Milk',   'Dairy',     50,  6,  300,  '2026-01-20 13:15:00'),
(1, 7, 'Rice',   'Groceries', 60,  12, 720,  '2026-01-21 17:20:00'),
(1, 7, 'Sugar',  'Groceries', 50,  11, 550,  '2026-01-21 17:25:00'),
(1, 8, 'Eggs',   'Dairy',     10,  45, 450,  '2026-01-22 14:50:00'),
(1, 8, 'Bread',  'Bakery',    40,  12, 480,  '2026-01-22 14:55:00'),
(1, 9, 'Milk',   'Dairy',     50,  16, 800,  '2026-01-23 18:30:00'),
(1, 9, 'Rice',   'Groceries', 60,  13, 780,  '2026-01-23 18:35:00'),
(1, 10, 'Sugar', 'Groceries', 50,  12, 600,  '2026-01-24 12:15:00'),
(1, 10, 'Eggs',  'Dairy',     10,  65, 650,  '2026-01-24 12:20:00'),
(1, 11, 'Bread', 'Bakery',    40,  12, 480,  '2026-01-25 10:40:00'),
(1, 11, 'Milk',  'Dairy',     50,  11, 550,  '2026-01-25 10:45:00'),
(1, 12, 'Rice',  'Groceries', 60,  15, 900,  '2026-01-26 16:00:00'),
(1, 12, 'Sugar', 'Groceries', 50,  16, 800,  '2026-01-26 16:05:00'),
(1, 13, 'Eggs',  'Dairy',     10,  48, 480,  '2026-01-27 11:30:00'),
(1, 13, 'Bread', 'Bakery',    40,  12, 480,  '2026-01-27 11:35:00'),
(1, 14, 'Milk',  'Dairy',     50,  14, 700,  '2026-01-28 09:20:00'),
(1, 14, 'Rice',  'Groceries', 60,  11, 660,  '2026-01-28 09:25:00'),
(1, 15, 'Sugar', 'Groceries', 50,  11, 550,  '2026-01-29 14:10:00'),
(1, 15, 'Eggs',  'Dairy',     10,  60, 600,  '2026-01-29 14:15:00'),
(1, 16, 'Bread', 'Bakery',    40,  15, 600,  '2026-01-30 13:00:00'),
(1, 16, 'Milk',  'Dairy',     50,  15, 750,  '2026-01-30 13:05:00'),
(1, 17, 'Rice',  'Groceries', 60,  8,  480,  '2026-01-31 15:45:00'),
(1, 17, 'Sugar', 'Groceries', 50,  8,  400,  '2026-01-31 15:50:00'),
(1, 18, 'Eggs',  'Dairy',     10,  70, 700,  '2026-02-01 10:00:00'),
(1, 18, 'Bread', 'Bakery',    40,  20, 800,  '2026-02-01 10:05:00'),
(1, 19, 'Milk',  'Dairy',     50,  13, 650,  '2026-02-02 11:10:00'),
(1, 19, 'Rice',  'Groceries', 60,  10, 600,  '2026-02-02 11:15:00'),
(1, 20, 'Sugar', 'Groceries', 50,  14, 700,  '2026-02-03 12:20:00'),
(1, 20, 'Eggs',  'Dairy',     10,  90, 900,  '2026-02-03 12:25:00');

-- Insert inventory items (for stockout risk analysis)
INSERT INTO inventory (shop_id, product_name, category, price, stock, barcode) VALUES
(1, 'Milk',  'Dairy',     50,  25,  'BAR001'),
(1, 'Bread', 'Bakery',    40,  18,  'BAR002'),
(1, 'Eggs',  'Dairy',     10,  100, 'BAR003'),
(1, 'Rice',  'Groceries', 60,  20,  'BAR004'),
(1, 'Sugar', 'Groceries', 50,  15,  'BAR005');