import jwt
import datetime
import requests
import json
import warnings
warnings.filterwarnings("ignore")

# Generate token for shop_id=1  (same secret as auth.py)
token = jwt.encode(
    {
        "user_id": 1,
        "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1)
    },
    "reco_secret_key",
    algorithm="HS256"
)

H    = {"Authorization": f"Bearer {token}"}
BASE = "http://127.0.0.1:5000"

endpoints = [
    ("Summary  daily",   f"{BASE}/analytics/summary?period=daily"),
    ("Summary  weekly",  f"{BASE}/analytics/summary?period=weekly"),
    ("Summary  monthly", f"{BASE}/analytics/summary?period=monthly"),
    ("Forecast",         f"{BASE}/analytics/forecast"),
    ("Demand",           f"{BASE}/analytics/demand"),
    ("Stockout Risk",    f"{BASE}/analytics/stockout-risk"),
]

all_ok = True
for name, url in endpoints:
    r = requests.get(url, headers=H, timeout=30)
    ok = r.status_code == 200
    if not ok:
        all_ok = False
    tag = "OK  " if ok else "FAIL"
    print(f"[{tag}] {name:20s}  HTTP {r.status_code}")
    try:
        d = r.json()
        if isinstance(d, list):
            print(f"       count = {len(d)}")
            if d:
                print(f"       first = {json.dumps(d[0], default=str)[:160]}")
        else:
            print(f"       {json.dumps(d, default=str)[:300]}")
    except Exception:
        print(f"       RAW: {r.text[:200]}")
    print()

print("=" * 50)
print("ALL ENDPOINTS PASSED" if all_ok else "SOME ENDPOINTS FAILED")
