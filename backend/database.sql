CREATE TABLE shops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_name VARCHAR(255),
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    country VARCHAR(100),
    state VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
