"""Compact test - writes to results.txt for reading"""
import jwt, datetime, requests, json, warnings, sys
warnings.filterwarnings("ignore")

out = open("results.txt", "w", encoding="utf-8")

def w(s=""):
    out.write(s + "\n")

SECRET_KEY = "reco_secret_key"
BASE       = "http://10.0.8.90:5000"

token = jwt.encode(
    {"user_id": 1, "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1)},
    SECRET_KEY, algorithm="HS256"
)
H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

passed = failed = 0

def check(label, r, exp):
    global passed, failed
    ok = r.status_code == exp
    if ok: passed += 1
    else:  failed += 1
    status = "OK  " if ok else "FAIL"
    try:    body = json.dumps(r.json(), default=str)[:200]
    except: body = r.text[:200]
    w(f"[{status}] {label}")
    w(f"       HTTP {r.status_code} | {body}")
    return r if ok else None

w("=== ADD TO CART FLOW ===")
r = requests.post(f"{BASE}/transactions/start", headers=H, timeout=10)
res = check("POST /transactions/start", r, 201)
txn_id = res.json().get("transaction_id") if res else None
w(f"  transaction_id = {txn_id}")

if txn_id:
    r = requests.post(f"{BASE}/transactions/add-item", headers=H, timeout=10, json={
        "transaction_id": txn_id, "product_name": "Parle-G", "category": "Snacks",
        "price": 20, "quantity": 2, "total": 40
    })
    check("POST /transactions/add-item (valid)", r, 200)

    r = requests.post(f"{BASE}/transactions/add-item", headers=H, timeout=10, json={
        "transaction_id": txn_id, "product_name": "Pepsi 500ml", "category": "Beverages",
        "price": 30, "quantity": 1, "total": 30
    })
    check("POST /transactions/add-item (2nd item)", r, 200)

    r = requests.get(f"{BASE}/transactions/{txn_id}", headers=H, timeout=10)
    res2 = check(f"GET /transactions/{txn_id}", r, 200)
    if res2:
        items = res2.json().get("items", [])
        w(f"  cart has {len(items)} item(s): {[i['description'] for i in items]}")

    r = requests.post(f"{BASE}/transactions/add-item", headers=H, timeout=10, json={
        "transaction_id": 999999, "product_name": "Ghost", "category": "X",
        "price": 10, "quantity": 1, "total": 10
    })
    check("POST /transactions/add-item (bad txn) -> expect 400", r, 400)

    r = requests.post(f"{BASE}/transactions/add-item", headers=H, timeout=10,
                      json={"transaction_id": txn_id, "product_name": "X"})
    check("POST /transactions/add-item (missing fields) -> expect 400", r, 400)

    r = requests.post(f"{BASE}/transactions/complete", headers=H, timeout=10,
                      json={"transaction_id": txn_id})
    check("POST /transactions/complete", r, 200)

    r = requests.post(f"{BASE}/transactions/add-item", headers=H, timeout=10, json={
        "transaction_id": txn_id, "product_name": "Parle-G", "category": "Snacks",
        "price": 20, "quantity": 1, "total": 20
    })
    check("POST /transactions/add-item (completed txn) -> expect 400", r, 400)

w("")
w("=== ADD TO INVENTORY FLOW ===")
r = requests.post(f"{BASE}/inventory/add", headers=H, timeout=10, json={
    "name": "Lays Classic", "category": "Snacks", "price": 20, "stock": 50
})
check("POST /inventory/add (valid)", r, 201)

r = requests.post(f"{BASE}/inventory/add", headers=H, timeout=10, json={
    "name": "Coca-Cola 500ml", "category": "Beverages", "price": 40, "stock": 100
})
check("POST /inventory/add (2nd product)", r, 201)

r = requests.post(f"{BASE}/inventory/add", headers=H, timeout=10, json={
    "name": "No Price", "category": "Snacks", "stock": 10
})
check("POST /inventory/add (missing price) -> expect 400", r, 400)

r = requests.get(f"{BASE}/inventory", headers=H, timeout=10)
res3 = check("GET /inventory", r, 200)
if res3:
    items = res3.json()
    w(f"  inventory has {len(items)} product(s)")
    for item in items[:3]:
        w(f"    - {item.get('product_name')} | price={item.get('price')} | stock={item.get('stock')}")

w("")
w("=== AUTH CHECKS ===")
no_auth = {"Content-Type": "application/json"}
r = requests.post(f"{BASE}/transactions/start", headers=no_auth, timeout=10)
check("POST /transactions/start (no token) -> expect 401", r, 401)

r = requests.post(f"{BASE}/inventory/add", headers=no_auth, timeout=10,
                  json={"name": "x", "price": 1, "stock": 1})
check("POST /inventory/add (no token) -> expect 401", r, 401)

w("")
w(f"=== SUMMARY: PASSED {passed}/{passed+failed}  FAILED {failed}/{passed+failed} ===")
w("ALL TESTS PASSED" if failed == 0 else f"SOME TESTS FAILED ({failed})")
out.close()
print(f"Done. PASSED={passed} FAILED={failed}")
