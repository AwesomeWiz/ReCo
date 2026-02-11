from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from routes.auth import auth_bp
from routes.sales import sales_bp

load_dotenv()

app = Flask(__name__)
CORS(app)

app.register_blueprint(auth_bp)
app.register_blueprint(sales_bp)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
