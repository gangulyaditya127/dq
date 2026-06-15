import base64
import json
import logging

from .config import settings

logger = logging.getLogger(__name__)


def gemini_invoke(system_prompt, history, message):
    """Call Gemini LLM and return the raw response text."""
    try:
        import google.generativeai as genai
    except ImportError as exc:
        raise RuntimeError(
            "google-generativeai is not installed. Run: pip install google-generativeai"
        ) from exc

    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set. Add it to backend/.env")

    genai.configure(api_key=settings.GEMINI_API_KEY)

    model = genai.GenerativeModel(
        model_name=settings.LLM_MODEL,
        system_instruction=system_prompt,
    )

    formatted_history = [
        {"role": msg["role"], "parts": [msg["text"]]}
        for msg in history
    ]

    chat = model.start_chat(history=formatted_history)
    response = chat.send_message(message)
    return response.text


def invoke_with_image(system_prompt, image_base64, image_mime, message):
    """Call Gemini with an image for multimodal analysis."""
    try:
        import google.generativeai as genai
    except ImportError as exc:
        raise RuntimeError(
            "google-generativeai is not installed. Run: pip install google-generativeai"
        ) from exc

    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set. Add it to backend/.env")

    genai.configure(api_key=settings.GEMINI_API_KEY)

    model = genai.GenerativeModel(
        model_name=settings.LLM_MODEL,
        system_instruction=system_prompt,
    )

    image_bytes = base64.b64decode(image_base64)
    logger.debug(
        "invoke_with_image — model=%s image_size=%d mime=%s",
        settings.LLM_MODEL, len(image_bytes), image_mime,
    )

    response = model.generate_content([
        {"mime_type": image_mime, "data": image_bytes},
        message,
    ])
    return response.text


def invoke(system_prompt, history, message):
    """Public dispatch — call Gemini."""
    logger.debug("LLM invoke — model=%s history_turns=%d", settings.LLM_MODEL, len(history))
    return gemini_invoke(system_prompt, history, message)


def analyze_incident(incident_details, activities, image_attachments, resolution_notes):
    """Orchestrate LLM analysis of an incident.

    Returns a dict with:
      - journals_summary: summary of work notes/comments
      - audit_summary: summary of field changes
      - image_analysis: analysis of image attachments
      - recommended_resolution: recommended resolution note
      - raw_response: the full LLM response
    """
    # --- Step 1: Analyze images (if any) ---
    image_descriptions = []
    for img in image_attachments:
        try:
            desc = invoke_with_image(
                system_prompt=(
                    "You are an IT incident analyst. Analyze this screenshot/image "
                    "attached to an IT incident ticket. Describe what you see — errors, "
                    "logs, UI states, configurations, error codes, stack traces, or any "
                    "relevant technical details. Be concise but thorough."
                ),
                image_base64=img["base64"],
                image_mime=img["content_type"],
                message=f"Describe this image attached to incident. Filename: {img['file_name']}",
            )
            image_descriptions.append({
                "file_name": img["file_name"],
                "description": desc,
            })
        except Exception as e:
            logger.warning("Failed to analyze image %s: %s", img["file_name"], e)
            image_descriptions.append({
                "file_name": img["file_name"],
                "description": f"[Analysis failed: {str(e)}]",
            })

    # --- Step 2: Build the main analysis prompt ---
    system_prompt = (
        "You are an expert IT Service Management (ITSM) analyst. You analyze incident "
        "tickets from ServiceNow and provide structured resolution recommendations.\n\n"
        "Your output MUST be in the following JSON format (and nothing else):\n"
        "{\n"
        '  "journals_summary": "A concise summary of all work notes and comments...",\n'
        '  "audit_summary": "A summary of key field changes (state transitions, reassignments, priority changes)...",\n'
        '  "image_analysis": "Combined analysis of all image attachments...",\n'
        '  "recommended_resolution": "A detailed, professional resolution note suitable for closing this incident..."\n'
        "}\n\n"
        "Guidelines for the recommended_resolution:\n"
        "- Summarize the root cause\n"
        "- Describe the fix/workaround applied\n"
        "- Note any follow-up actions or preventive measures\n"
        "- Be professional and concise\n"
        "- If resolution notes already exist, improve and enhance them\n"
    )

    # Build context message
    context_parts = []

    # Incident details
    context_parts.append("=== INCIDENT DETAILS ===")
    for key, value in incident_details.items():
        if value and key not in ("sys_id", "is_resolved", "resolution_notes"):
            context_parts.append(f"{key}: {value}")

    # Activities
    context_parts.append("\n=== ACTIVITY TIMELINE ===")
    journals = [a for a in activities if a["type"] in ("work_note", "comment")]
    field_changes = [a for a in activities if a["type"] == "field_change"]
    attachments_list = [a for a in activities if a["type"] == "attachment"]

    if journals:
        context_parts.append("\n--- Work Notes & Comments ---")
        for j in journals:
            context_parts.append(
                f"[{j['created_on']}] ({j['type']}) by {j['created_by']}: {j['note']}"
            )

    if field_changes:
        context_parts.append("\n--- Field Changes (Audit) ---")
        for fc in field_changes:
            context_parts.append(
                f"[{fc['created_on']}] {fc['field']}: '{fc['old_value']}' → '{fc['new_value']}' by {fc['created_by']}"
            )

    if attachments_list:
        context_parts.append("\n--- Attachments ---")
        for att in attachments_list:
            context_parts.append(
                f"[{att['created_on']}] {att['file_name']} ({att['content_type']}, {att['size']} bytes) by {att['created_by']}"
            )

    # Image descriptions
    if image_descriptions:
        context_parts.append("\n--- Image Analysis ---")
        for img_desc in image_descriptions:
            context_parts.append(f"Image '{img_desc['file_name']}': {img_desc['description']}")

    # Resolution notes
    if resolution_notes:
        context_parts.append(f"\n=== EXISTING RESOLUTION NOTES ===\n{resolution_notes}")

    context_parts.append(
        "\n=== TASK ===\n"
        "Based on all the above information, provide your analysis in the JSON format specified."
    )

    message = "\n".join(context_parts)

    # Call LLM
    raw_response = invoke(system_prompt, [], message)

    # Parse JSON from response
    try:
        # Try to extract JSON from the response (handle markdown code blocks)
        json_str = raw_response
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        parsed = json.loads(json_str.strip())
    except (json.JSONDecodeError, IndexError):
        logger.warning("Failed to parse LLM JSON response, returning raw")
        parsed = {
            "journals_summary": "Analysis could not be structured. See raw response.",
            "audit_summary": "",
            "image_analysis": "",
            "recommended_resolution": raw_response,
        }

    parsed["raw_response"] = raw_response
    return parsed
