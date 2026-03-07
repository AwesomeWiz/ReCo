from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from routes.auth import auth_bp
from routes.sales import sales_bp
from routes.inventory import inventory_bp
from routes.manufacturer import manufacturer_bp

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://10.0.8.90:3000"])

app.register_blueprint(auth_bp)
app.register_blueprint(sales_bp)
app.register_blueprint(inventory_bp)
app.register_blueprint(manufacturer_bp)

@app.route("/")
def home():
    return "Backend running"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)