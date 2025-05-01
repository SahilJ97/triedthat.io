from dotenv import load_dotenv
import json
from backend import log_message
from backend.auth import get_current_user
from backend.models import ParseField, ParseFieldValue, ParsedResponse
from backend.utils import user_can_perform_limited_action
from fastapi import APIRouter, Request, HTTPException
from backend import db_context

from backend.utils import extract_fields

router = APIRouter()

load_dotenv()


@router.post("/api/experience/submit")
async def api_submit_experience(request: Request):
    """
    Endpoint to submit or edit an experience
    :param request: Must contain JSON body with keys "experienceName" and "experience". Optional key "existingExperienceId" for editing an existing entry
    :return: JSON response
    """
    data = await request.json()
    experience_name = data["experienceName"]
    experience = data["experience"]
    anonymize = data.get("anonymize", False)
    existing_response_id = data.get("existingExperienceId")

    with db_context() as db:
        current_user = await get_current_user(request=request, db=db, optional=False)
        current_user_id = current_user.id

        # Enforce rate limits for user
        user_data = current_user.user_data()
        user_actions = user_data.setdefault("actions", {})
        can_proceed, new_user_actions = user_can_perform_limited_action(
            user_actions,
            action_identifier="submit_experience",
            time_limit_hours=1,
            action_limit=10
        )
        if not can_proceed:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later."
            )
        user_data["actions"] = new_user_actions
        current_user.user_json = json.dumps(user_data)
        db.add(current_user)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            log_message(f"Failed to update user actions: {str(e)}", error=True)
            raise HTTPException(
                status_code=500,
                detail="An error occurred on our end."
            )

    log_message(f"api_submit_experience() called by user: {current_user} with experience_name: {experience_name}")
    try:
        field_response_pairs = extract_fields(experience)
    except Exception as e:
        log_message(f"Failed to extract fields: {str(e)}", error=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to extract fields from response."
        )

    log_message(f"Got field_response_pairs: {field_response_pairs}")

    with db_context() as db:
        # First, add new ParseField objects to the database as needed
        parse_fields = []
        for field, response in field_response_pairs:
            parse_field = db.query(ParseField).filter(ParseField.name == field).first()
            if parse_field is None:
                log_message(f"Adding new ParseField to database: {field}")
                parse_field = ParseField(name=field)
                db.add(parse_field)
                try:
                    db.commit()
                except Exception as e:
                    db.rollback()
                    log_message(f"Failed to add new ParseField to database: {str(e)}", error=True)
                    raise HTTPException(
                        status_code=500,
                        detail="An error occurred on our end."
                    )
            parse_fields.append(parse_field)

        # Fetch and modify existing ParsedResponse (if we're simply editing) or create a new one and flush it to the database (if we're adding)
        if existing_response_id is not None:
            log_message(f"Editing existing ParsedResponse with id: {existing_response_id}")
            parsed_response = db.query(ParsedResponse).filter(ParsedResponse.id == existing_response_id).first()
            if parsed_response is None:
                raise HTTPException(
                    status_code=404,
                    detail="No such experience entry exists"
                )
            parsed_response.name = experience_name
            parsed_response.raw_text = experience
            parsed_response.anonymize = anonymize
            db.add(parsed_response)
            for parse_field_value in parsed_response.parse_field_values:
                db.delete(parse_field_value)
            db.flush()
        else:
            log_message(f"Adding new ParsedResponse")
            parsed_response = ParsedResponse(
                user_id=current_user_id,
                name=experience_name,
                raw_text=experience,
                anonymize=anonymize
            )
            db.add(parsed_response)
            db.flush()

        # Add ParseFieldValue objects for ParsedResponse
        for parsed_field, (_, response) in zip(parse_fields, field_response_pairs):
            parse_field_value = ParseFieldValue(
                parse_field_id=parsed_field.id,
                parsed_response_id=parsed_response.id,
                value=response
            )
            db.add(parse_field_value)

        # Commit response and field values to database
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            log_message(f"Failed to commit response and field values to database: {str(e)}", error=True)
            raise HTTPException(
                status_code=500,
                detail="An error occurred on our end."
            )

        # Return JSON with fields_extracted, which maps fields to whether they were found in the submitted text
        return {
            "fields_extracted": {field: response is not None for field, response in field_response_pairs}
        }

@router.get("/api/experience")
async def get_experience(request: Request, experienceId: int = None, userId: int = None, maxNumber: int = None):
    """
    Flexible endpoint to fetch experience (ParsedResponse) entries.
    - experienceId: Optional[int] - filter by ParsedResponse's id column if provided
    - userId: Optional[int] - filter by user_id if provided
    - maxNumber: Optional[int] - limit the number of results if provided
    """
    log_message(f"get_experience called with experienceId: {experienceId}, userId: {userId}, maxNumber: {maxNumber}")
    with db_context() as db:
        current_user = await get_current_user(request=request, db=db, optional=True)  # TODO: Make this work (not be None)
        log_message(f"Current user: {current_user.id if current_user else None}")
        query = db.query(ParsedResponse)
        if experienceId is not None:
            query = query.filter(ParsedResponse.id == experienceId)
        if userId is not None:
            query = query.filter(ParsedResponse.user_id == userId)
        query = query.order_by(ParsedResponse.created_at.desc())
        if maxNumber is not None:
            query = query.limit(maxNumber)
        results = query.all()

        result_dicts = []
        for result in results:
            anonymize = result.anonymize
            if current_user is not None and current_user.id == result.user_id:  # If the user is the owner, we should display their information
                anonymize = False
            result_dict = {
                "id": result.id,
                "user_id": result.user_id if not anonymize else None,
                "name": result.name,
                "raw_text": result.raw_text,
                "created_at": result.created_at.isoformat(),
                "updated_at": result.updated_at.isoformat(),
                "fields_extracted": {parse_field_value.parse_field.name: parse_field_value.value for parse_field_value in result.parse_field_values},
                "first_name": result.user.first_name if not anonymize else None,
                "last_name": result.user.last_name if not anonymize else None,
                "profile_picture_url": result.user.profile_picture_url if not anonymize else None
            }
            result_dicts.append(result_dict)

    if len(result_dicts) == 1:
        log_message(f"get_experience() returned one result: {result_dicts}")

    return {"results": result_dicts}

@router.delete("/api/experience")
async def delete_experience(experienceId: int):
    log_message(f"delete_experience called with experienceId: {experienceId}")
    with db_context() as db:
        parsed_response = db.query(ParsedResponse).filter(ParsedResponse.id == experienceId).first()
        if parsed_response is None:
            raise HTTPException(
                status_code=404,
                detail="No such experience entry exists"
            )
        db.delete(parsed_response)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            log_message(f"Failed to delete experience entry: {str(e)}", error=True)
            raise HTTPException(
                status_code=500,
                detail="An error occurred on our end."
            )
        return {"message": "Experience entry deleted successfully"}
