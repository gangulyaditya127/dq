import base64
import requests
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from .config import settings

logger = logging.getLogger(__name__)

HEADERS = {"Accept": "application/json"}

# Reference field resolution map (from sc3.py)
REFERENCE_FIELD_MAP = {
    "assignment_group": {"table": "sys_user_group", "display_field": "name"},
    "assigned_to": {"table": "sys_user", "display_field": "name"},
    "caller_id": {"table": "sys_user", "display_field": "name"},
    "opened_by": {"table": "sys_user", "display_field": "name"},
    "closed_by": {"table": "sys_user", "display_field": "name"},
    "resolved_by": {"table": "sys_user", "display_field": "name"},
}

SKIP_AUDIT_FIELDS = {"sys_mod_count", "sys_updated_on", "sys_updated_by", "work_notes", "comments"}


def _auth():
    return (settings.SERVICENOW_USERNAME, settings.SERVICENOW_PASSWORD)


def _request_table(table, params=None):
    """Generic ServiceNow table API request."""
    url = f"{settings.SERVICENOW_BASE_URL}/api/now/table/{table}"
    response = requests.get(url, auth=_auth(), headers=HEADERS, params=params, timeout=30)
    response.raise_for_status()
    return response.json().get("result", [])


def get_incident_sys_id(incident_number):
    """Resolve incident number to sys_id."""
    params = {
        "sysparm_query": f"number={incident_number}",
        "sysparm_fields": "sys_id",
    }
    results = _request_table("incident", params)
    return results[0]["sys_id"] if results else None


def get_incident_details(incident_number):
    """Fetch core incident fields and detect resolved state."""
    params = {
        "sysparm_query": f"number={incident_number}",
        "sysparm_fields": (
            "sys_id,number,short_description,description,state,priority,urgency,impact,"
            "category,subcategory,assignment_group,assigned_to,opened_by,opened_at,"
            "resolved_by,resolved_at,closed_by,closed_at,close_notes,close_code,"
            "caller_id,contact_type,cmdb_ci,business_service,sys_created_on"
        ),
        "sysparm_display_value": "true",
    }
    results = _request_table("incident", params)
    if not results:
        return None

    incident = results[0]

    # Determine if incident is resolved or closed
    state_lower = (incident.get("state") or "").lower()
    is_resolved = state_lower in ("resolved", "closed", "6", "7")

    resolution_notes = ""
    if is_resolved:
        resolution_notes = incident.get("close_notes", "")

    return {
        "sys_id": incident.get("sys_id"),
        "number": incident.get("number"),
        "short_description": incident.get("short_description"),
        "description": incident.get("description"),
        "state": incident.get("state"),
        "priority": incident.get("priority"),
        "urgency": incident.get("urgency"),
        "impact": incident.get("impact"),
        "category": incident.get("category"),
        "subcategory": incident.get("subcategory"),
        "assignment_group": incident.get("assignment_group"),
        "assigned_to": incident.get("assigned_to"),
        "opened_by": incident.get("opened_by"),
        "opened_at": incident.get("opened_at"),
        "resolved_by": incident.get("resolved_by"),
        "resolved_at": incident.get("resolved_at"),
        "closed_by": incident.get("closed_by"),
        "closed_at": incident.get("closed_at"),
        "close_notes": incident.get("close_notes"),
        "close_code": incident.get("close_code"),
        "caller_id": incident.get("caller_id"),
        "contact_type": incident.get("contact_type"),
        "cmdb_ci": incident.get("cmdb_ci"),
        "business_service": incident.get("business_service"),
        "sys_created_on": incident.get("sys_created_on"),
        "is_resolved": is_resolved,
        "resolution_notes": resolution_notes,
    }


def get_work_notes_and_comments(incident_sys_id):
    """Pull work_notes and comments from sys_journal_field."""
    params = {
        "sysparm_query": (
            f"element_id={incident_sys_id}"
            "^elementINwork_notes,comments"
            "^ORDERBYsys_created_on"
        ),
        "sysparm_fields": "sys_id,element,value,sys_created_on,sys_created_by",
        "sysparm_display_value": "true",
    }
    return _request_table("sys_journal_field", params)


def get_incident_attachments(incident_sys_id):
    """Fetch attachment metadata for an incident."""
    params = {
        "sysparm_query": f"table_sys_id={incident_sys_id}^table_name=incident",
        "sysparm_fields": "sys_id,file_name,content_type,size,sys_created_on,sys_created_by",
    }
    return _request_table("sys_attachment", params)


def get_field_change_history(incident_sys_id):
    """Pull field-level audit history from sys_audit."""
    params = {
        "sysparm_query": (
            f"documentkey={incident_sys_id}"
            "^tablename=incident"
            "^ORDERBYsys_created_on"
        ),
        "sysparm_fields": "sys_id,fieldname,oldvalue,newvalue,sys_created_on,sys_created_by,documentkey",
        "sysparm_display_value": "true",
    }
    return _request_table("sys_audit", params)


def download_attachment_file(attachment_sys_id):
    """Download raw attachment bytes."""
    url = f"{settings.SERVICENOW_BASE_URL}/api/now/attachment/{attachment_sys_id}/file"
    response = requests.get(
        url,
        auth=_auth(),
        headers={"Accept": "application/octet-stream"},
        timeout=30,
    )
    response.raise_for_status()
    return response.content


# --- Reference resolver (from sc3.py) ---

def _is_sys_id(value):
    """Heuristic: ServiceNow sys_ids are 32-char lowercase hex strings."""
    if not value or not isinstance(value, str) or len(value) != 32:
        return False
    try:
        int(value, 16)
        return True
    except ValueError:
        return False


def _build_reference_resolver_cache(audit_entries):
    """Pre-fetch referenced sys_ids in batches to avoid N individual lookups."""
    ids_by_table = {}
    for entry in audit_entries:
        field = entry.get("fieldname")
        mapping = REFERENCE_FIELD_MAP.get(field)
        if not mapping:
            continue
        table = mapping["table"]
        for val in (entry.get("oldvalue"), entry.get("newvalue")):
            if _is_sys_id(val):
                ids_by_table.setdefault(table, set()).add(val)

    cache = {}
    for table, ids in ids_by_table.items():
        if not ids:
            continue
        display_field = next(
            m["display_field"] for m in REFERENCE_FIELD_MAP.values() if m["table"] == table
        )
        id_list = ",".join(ids)
        params = {
            "sysparm_query": f"sys_idIN{id_list}",
            "sysparm_fields": f"sys_id,{display_field}",
        }
        results = _request_table(table, params)
        cache[table] = {
            row["sys_id"]: row.get(display_field, row["sys_id"]) for row in results
        }
    return cache


def _resolve_value(field, value, resolver_cache):
    """Resolve a sys_id to its display value if it's a known reference field."""
    mapping = REFERENCE_FIELD_MAP.get(field)
    if not mapping or not _is_sys_id(value):
        return value
    table_cache = resolver_cache.get(mapping["table"], {})
    return table_cache.get(value, value)


def get_incident_activity(incident_number):
    """Fetch consolidated activity: journals + attachments + audit."""
    sys_id = get_incident_sys_id(incident_number)
    if not sys_id:
        return None

    journal_entries = get_work_notes_and_comments(sys_id)
    attachments = get_incident_attachments(sys_id)
    audit_entries = get_field_change_history(sys_id)

    resolver_cache = _build_reference_resolver_cache(audit_entries)

    activity = []

    # Journals
    for entry in journal_entries:
        activity.append({
            "type": "work_note" if entry["element"] == "work_notes" else "comment",
            "sys_id": entry["sys_id"],
            "created_on": entry["sys_created_on"],
            "created_by": entry["sys_created_by"],
            "note": entry["value"],
        })

    # Attachments
    for attachment in attachments:
        activity.append({
            "type": "attachment",
            "sys_id": attachment.get("sys_id"),
            "file_name": attachment.get("file_name"),
            "content_type": attachment.get("content_type"),
            "size": attachment.get("size"),
            "created_on": attachment.get("sys_created_on"),
            "created_by": attachment.get("sys_created_by"),
        })

    # Audit (field changes)
    for entry in audit_entries:
        field = entry.get("fieldname")
        if field in SKIP_AUDIT_FIELDS:
            continue
        activity.append({
            "type": "field_change",
            "sys_id": entry["sys_id"],
            "field": field,
            "old_value": _resolve_value(field, entry.get("oldvalue"), resolver_cache),
            "new_value": _resolve_value(field, entry.get("newvalue"), resolver_cache),
            "created_on": entry["sys_created_on"],
            "created_by": entry["sys_created_by"],
        })

    return sorted(activity, key=lambda item: item["created_on"])


def get_image_attachments_base64(incident_number):
    """Download image attachments and return them as base64-encoded list."""
    sys_id = get_incident_sys_id(incident_number)
    if not sys_id:
        return []

    attachments = get_incident_attachments(sys_id)
    image_attachments = []

    for att in attachments:
        content_type = att.get("content_type", "")
        if not content_type.startswith("image/"):
            continue
        try:
            raw_bytes = download_attachment_file(att["sys_id"])
            image_attachments.append({
                "sys_id": att["sys_id"],
                "file_name": att.get("file_name", "unknown"),
                "content_type": content_type,
                "base64": base64.b64encode(raw_bytes).decode("utf-8"),
            })
        except Exception as e:
            logger.warning("Failed to download image attachment %s: %s", att.get("file_name"), e)

    return image_attachments


def _consolidate_activity(journal_entries, attachments, audit_entries):
    """Consolidate journals, attachments, and audit entries into a sorted activity list."""
    resolver_cache = _build_reference_resolver_cache(audit_entries)

    activity = []

    # Journals
    for entry in journal_entries:
        activity.append({
            "type": "work_note" if entry["element"] == "work_notes" else "comment",
            "sys_id": entry["sys_id"],
            "created_on": entry["sys_created_on"],
            "created_by": entry["sys_created_by"],
            "note": entry["value"],
        })

    # Attachments
    for attachment in attachments:
        activity.append({
            "type": "attachment",
            "sys_id": attachment.get("sys_id"),
            "file_name": attachment.get("file_name"),
            "content_type": attachment.get("content_type"),
            "size": attachment.get("size"),
            "created_on": attachment.get("sys_created_on"),
            "created_by": attachment.get("sys_created_by"),
        })

    # Audit (field changes)
    for entry in audit_entries:
        field = entry.get("fieldname")
        if field in SKIP_AUDIT_FIELDS:
            continue
        activity.append({
            "type": "field_change",
            "sys_id": entry["sys_id"],
            "field": field,
            "old_value": _resolve_value(field, entry.get("oldvalue"), resolver_cache),
            "new_value": _resolve_value(field, entry.get("newvalue"), resolver_cache),
            "created_on": entry["sys_created_on"],
            "created_by": entry["sys_created_by"],
        })

    return sorted(activity, key=lambda item: item["created_on"])


def _download_images_parallel(attachments):
    """Download image attachments in parallel and return base64-encoded list."""
    image_metas = [
        att for att in attachments
        if att.get("content_type", "").startswith("image/")
    ]
    if not image_metas:
        return []

    image_attachments = []

    def _download_one(att):
        raw_bytes = download_attachment_file(att["sys_id"])
        return {
            "sys_id": att["sys_id"],
            "file_name": att.get("file_name", "unknown"),
            "content_type": att.get("content_type"),
            "base64": base64.b64encode(raw_bytes).decode("utf-8"),
        }

    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_download_one, att): att for att in image_metas}
        for future in as_completed(futures):
            att = futures[future]
            try:
                image_attachments.append(future.result())
            except Exception as e:
                logger.warning("Failed to download image %s: %s", att.get("file_name"), e)

    return image_attachments


def recommend_resolution_data(incident_number):
    """Single-call orchestrator: fetches all ServiceNow data needed for resolution.

    Flow:
      1. Fetch incident details (need sys_id first)
      2. In parallel: fetch journals, audit history, and attachment metadata
      3. Consolidate into activity timeline
      4. Download image attachments in parallel
      5. Extract resolution notes if incident is resolved

    Returns:
        dict with keys: incident_details, activity, image_attachments, resolution_notes
        or None if incident not found.
    """
    # Step 1: Get incident details (we need sys_id for everything else)
    logger.info("Step 1: Fetching incident details for %s", incident_number)
    details = get_incident_details(incident_number)
    if not details:
        return None

    sys_id = details["sys_id"]
    logger.info("Incident found: sys_id=%s, state=%s", sys_id, details.get("state"))

    # Step 2: Fetch journals, audit, and attachments IN PARALLEL
    logger.info("Step 2: Fetching journals, audit, attachments in parallel ...")
    journal_entries = []
    audit_entries = []
    attachments_raw = []

    with ThreadPoolExecutor(max_workers=3) as pool:
        future_journals = pool.submit(get_work_notes_and_comments, sys_id)
        future_audit = pool.submit(get_field_change_history, sys_id)
        future_attachments = pool.submit(get_incident_attachments, sys_id)

        try:
            journal_entries = future_journals.result(timeout=60)
            logger.info("  Journals fetched: %d entries", len(journal_entries))
        except Exception as e:
            logger.error("  Failed to fetch journals: %s", e)

        try:
            audit_entries = future_audit.result(timeout=60)
            logger.info("  Audit entries fetched: %d entries", len(audit_entries))
        except Exception as e:
            logger.error("  Failed to fetch audit: %s", e)

        try:
            attachments_raw = future_attachments.result(timeout=60)
            logger.info("  Attachments fetched: %d entries", len(attachments_raw))
        except Exception as e:
            logger.error("  Failed to fetch attachments: %s", e)

    # Step 3: Consolidate activity
    logger.info("Step 3: Consolidating activity ...")
    activity = _consolidate_activity(journal_entries, attachments_raw, audit_entries)
    logger.info("  Total activity items: %d", len(activity))

    # Step 4: Download image attachments in parallel
    logger.info("Step 4: Downloading image attachments ...")
    image_attachments = _download_images_parallel(attachments_raw)
    logger.info("  Images downloaded: %d", len(image_attachments))

    # Step 5: Resolution notes
    resolution_notes = details.get("resolution_notes", "")
    if resolution_notes:
        logger.info("Step 5: Existing resolution notes found.")

    return {
        "incident_details": details,
        "activity": activity,
        "image_attachments": image_attachments,
        "resolution_notes": resolution_notes,
    }


