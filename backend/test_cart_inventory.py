# -*- coding: utf-8 -*-
"""
test_cart_inventory.py
Comprehensive test for:
  1. Add to Cart  → POST /transactions/start  +  POST /transactions/add-item
  2. Add to Inventory → POST /inventory/add
  3. Cleanup: GET /inventory, GET /transactions/<id>
"""

import jwt
import datetime
import requests
import json
import warnings
warnings.filterwarnings("ignore")

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY = "reco_secret_key"
BASE       = "http://10.0.8.90:5000"
SHOP_ID    = 1   # Matches shops table row 1 (Test Store)

# ── Generate a fresh JWT (valid for 1 day) ────────────────────────────────────
token = jwt.encode(
    {
        "user_id": SHOP_ID,
        "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1),
    },
    SECRET_KEY,
    algorithm="HS256",
)

H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ── Helpers ───────────────────────────────────────────────────────────────────
passed = 0
failed = 0

def check(label, response, expected_status=200):
    global passed, failed
    ok = response.status_code == expected_status
    tag = "OK  " if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
    print(f"[{tag}] {label:45s}  HTTP {response.status_code}")
    try:
        d = response.json()
        print(f"       {json.dumps(d, default=str)[:300]}")
    except Exception:
        print(f"       RAW: {response.text[:200]}")
    print()
    return response if ok else None


# ══════════════════════════════════════════════════════════════════════════════
# 1. ADD TO CART FLOW
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("1. ADD TO CART FLOW")
print("=" * 60)
print()

# 1a. Start a transaction
r = requests.post(f"{BASE}/transactions/start", headers=H, timeout=10)
res = check("POST /transactions/start", r, expected_status=201)

transaction_id = None
if res:
    transaction_id = res.json().get("transaction_id")
    print(f"  -> Got transaction_id = {transaction_id}\n")

# 1b. Add an item to the transaction
if transaction_id:
    payload = {
        "transaction_id": transaction_id,
        "product_name":   "Parle-G Biscuits",
        "category":       "Snacks",
        "price":          20,
        "quantity":       2,
        "total":          40,
    }
    r = requests.post(f"{BASE}/transactions/add-item", headers=H, json=payload, timeout=10)
    check("POST /transactions/add-item (valid)", r, expected_status=200)

    # 1c. Add a second item
    payload2 = {
        "transaction_id": transaction_id,
        "product_name":   "Pepsi 500ml",
        "category":       "Beverages",
        "price":          30,
        "quantity":       1,
        "total":          30,
    }
    r = requests.post(f"{BASE}/transactions/add-item", headers=H, json=payload2, timeout=10)
    check("POST /transactions/add-item (second item)", r, expected_status=200)

    # 1d. Fetch transaction items
    r = requests.get(f"{BASE}/transactions/{transaction_id}", headers=H, timeout=10)
    check(f"GET /transactions/{transaction_id}", r, expected_status=200)

    # 1e. Edge case – add item to non-existent transaction
    bad_payload = {
        "transaction_id": 999999,
        "product_name":   "Ghost Product",
        "category":       "Snacks",
        "price":          10,
        "quantity":       1,
        "total":          10,
    }
    r = requests.post(f"{BASE}/transactions/add-item", headers=H, json=bad_payload, timeout=10)
    check("POST /transactions/add-item (bad txn_id) → expect 400", r, expected_status=400)

    # 1f. Edge case – missing required field
    r = requests.post(f"{BASE}/transactions/add-item", headers=H,
                      json={"transaction_id": transaction_id, "product_name": "X"}, timeout=10)
    check("POST /transactions/add-item (missing fields) → expect 400", r, expected_status=400)

    # 1g. Complete the transaction
    r = requests.post(f"{BASE}/transactions/complete", headers=H,
                      json={"transaction_id": transaction_id}, timeout=10)
    check("POST /transactions/complete", r, expected_status=200)

    # 1h. Try adding to completed transaction (should fail)
    r = requests.post(f"{BASE}/transactions/add-item", headers=H, json=payload, timeout=10)
    check("POST /transactions/add-item (completed txn) → expect 400", r, expected_status=400)

else:
    print("[SKIP] Skipping add-item tests — no transaction_id returned\n")


# ══════════════════════════════════════════════════════════════════════════════
# 2. ADD TO INVENTORY FLOW
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("2. ADD TO INVENTORY FLOW")
print("=" * 60)
print()

# 2a. Add a valid product
inv_payload = {
    "name":     "Lay's Classic Salted",
    "category": "Snacks",
    "price":    20,
    "stock":    50,
}
r = requests.post(f"{BASE}/inventory/add", headers=H, json=inv_payload, timeout=10)
check("POST /inventory/add (valid product)", r, expected_status=201)

# 2b. Add another product
r = requests.post(f"{BASE}/inventory/add", headers=H, json={
    "name":     "Coca-Cola 500ml",
    "category": "Beverages",
    "price":    40,
    "stock":    100,
}, timeout=10)
check("POST /inventory/add (second product)", r, expected_status=201)

# 2c. Edge case – missing price field (expect 500 or 400)
r = requests.post(f"{BASE}/inventory/add", headers=H, json={
    "name":     "No Price Product",
    "category": "Snacks",
    "stock":    10,
}, timeout=10)
# Missing 'price' causes a KeyError → 500
print("[INFO] Missing price field (expect error):")
check("POST /inventory/add (missing price) → expect error", r, expected_status=500)

# 2d. Fetch current inventory to confirm items were saved
r = requests.get(f"{BASE}/inventory", headers=H, timeout=10)
res = check("GET /inventory", r, expected_status=200)
if res:
    items = res.json()
    print(f"  -> {len(items)} product(s) in inventory\n")


# ══════════════════════════════════════════════════════════════════════════════
# 3. UNAUTHENTICATED ACCESS (expect 401)
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 60)
print("3. AUTH CHECKS")
print("=" * 60)
print()

no_auth = {"Content-Type": "application/json"}
r = requests.post(f"{BASE}/transactions/start", headers=no_auth, timeout=10)
check("POST /transactions/start (no token) → expect 401", r, expected_status=401)

r = requests.post(f"{BASE}/inventory/add", headers=no_auth,
                  json={"name": "x", "price": 1, "stock": 1}, timeout=10)
check("POST /inventory/add (no token) → expect 401", r, expected_status=401)


# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 60)
total = passed + failed
print(f"PASSED: {passed}/{total}   FAILED: {failed}/{total}")
print("ALL TESTS PASSED" if failed == 0 else f"{failed} TEST(S) FAILED")
print("=" * 60)
