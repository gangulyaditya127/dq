import logging
from flask import Flask
from flask_cors import CORS
from flasgger import Swagger


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Configure logging so errors are visible in the terminal
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # Swagger configuration
    app.config["SWAGGER"] = {
        "title": "Incident Resolution Recommender API",
        "uiversion": 3,
        "description": (
            "AI-powered API that fetches ServiceNow incident data, "
            "analyzes it with Gemini LLM, and recommends resolution notes."
        ),
        "version": "1.0.0",
        "termsOfService": "",
        "specs_route": "/apidocs/",
    }
    Swagger(app)

    from .routes import api_bp
    app.register_blueprint(api_bp)

    return app
