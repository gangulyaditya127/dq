import logging
import traceback
from flask import Blueprint, jsonify, request

from . import servicenow, llm
from .config import settings

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.route("/health", methods=["GET"])
def health():
    """Health check endpoint
    ---
    tags:
      - System
    responses:
      200:
        description: API is running
        schema:
          type: object
          properties:
            status:
              type: string
              example: ok
    """
    return jsonify({"status": "ok"})


@api_bp.route("/recommend_resolution", methods=["POST"])
def recommend_resolution():
    """Recommend a resolution for a ServiceNow incident
    ---
    tags:
      - Resolution
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - incident_number
          properties:
            incident_number:
              type: string
              description: ServiceNow incident number
              example: INC0010001
    responses:
      200:
        description: Incident analysis and resolution recommendation
        schema:
          type: object
          properties:
            incident_number:
              type: string
            incident_details:
              type: object
              description: Core incident fields from ServiceNow
            activity:
              type: array
              description: Consolidated timeline (journals, audit, attachments)
              items:
                type: object
            is_resolved:
              type: boolean
            analysis:
              type: object
              description: LLM analysis results
              properties:
                journals_summary:
                  type: string
                  description: Summary of work notes and comments
                audit_summary:
                  type: string
                  description: Summary of field changes
                image_analysis:
                  type: string
                  description: Analysis of image attachments
                recommended_resolution:
                  type: string
                  description: AI-recommended resolution note
      400:
        description: Missing incident_number
      404:
        description: Incident not found
      500:
        description: Internal server error
    """
    body = request.get_json(silent=True) or {}
    incident_number = body.get("incident_number", "").strip()

    if not incident_number:
        return jsonify({"error": "incident_number is required"}), 400

    # --- Validate credentials are loaded ---
    if not settings.SERVICENOW_USERNAME or not settings.SERVICENOW_PASSWORD:
        logger.error("ServiceNow credentials not configured in .env")
        return jsonify({"error": "ServiceNow credentials not configured. Check backend/.env"}), 500

    if not settings.GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not configured in .env")
        return jsonify({"error": "GEMINI_API_KEY not configured. Check backend/.env"}), 500

    try:
        # Step 1-4: Fetch all ServiceNow data (with parallel internal fetching)
        logger.info("Fetching ServiceNow data for %s ...", incident_number)
        data = servicenow.recommend_resolution_data(incident_number)
        if data is None:
            return jsonify({"error": f"Incident {incident_number} not found in ServiceNow"}), 404

        logger.info(
            "ServiceNow data fetched: %d activities, %d images",
            len(data["activity"]),
            len(data["image_attachments"]),
        )

        # Step 5: Run LLM analysis
        logger.info("Running LLM analysis ...")
        analysis = llm.analyze_incident(
            incident_details=data["incident_details"],
            activities=data["activity"],
            image_attachments=data["image_attachments"],
            resolution_notes=data["resolution_notes"],
        )
        logger.info("LLM analysis complete.")

        # Step 6: Return everything
        return jsonify({
            "incident_number": incident_number,
            "incident_details": data["incident_details"],
            "activity": data["activity"],
            "is_resolved": data["incident_details"].get("is_resolved", False),
            "analysis": analysis,
        })

    except Exception as e:
        tb = traceback.format_exc()
        logger.error("Error in recommend_resolution for %s:\n%s", incident_number, tb)
        return jsonify({"error": str(e), "traceback": tb}), 500
