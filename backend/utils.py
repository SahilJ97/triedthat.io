from backend import fields_for_extraction, open_ai_client
from typing import Optional
from datetime import datetime, timezone, timedelta

def open_ai_llm_call(
    prompt: str,
    model: str = "gpt-4o",
    max_retries: int = 0,
    retry_message_override: Optional[str] = None,
    validate_and_process_fn: Optional[callable] = None,
):
    """
    :param prompt: Prompt to send to OpenAI
    :param model: Model to use
    :param max_retries: Maximum number of retries
    :param retry_message_override: If specified, overrides the default retry message
    :param validate_and_process_fn: Function to validate and process the response. Should raise an error for invalid responses
    :return: Output of validate_and_process_fn if it is specified, else the raw response content
    :raises Exception: If the response is not valid
    """
    retry_message = retry_message_override or "There was an error processing your output. Please try again, making sure to follow the instructions."
    conversation = [{"role": "user", "content": prompt}]
    for attempt in range(max_retries + 1):
        response = open_ai_client.chat.completions.create(
            model=model,
            messages=conversation
        )
        response_content = response.choices[0].message.content.strip()
        if validate_and_process_fn is not None:
            try:
                return validate_and_process_fn(response_content)
            except Exception as e:
                conversation.extend([
                    {"role": "assistant", "content": response_content},
                    {"role": "user", "content": retry_message}
                ])
    raise ValueError(f"Failed after {max_retries} attempts")

extract_fields_prompt = """Consider this list of data fields, which may concern entrepreneurial endeavors ranging from a small local business to an ambitious tech startup:
{fields}

Also consider this text, which describes a particular entrepreneurial journey:
{submitted_text}

Your task is to extract the aforementioned fields from the text. If a field is not present, fill it with "N/A". You may need to rephrase/reorganize bits from the original text to populate a field. Don't discard any information that addresses the field, and don't infer anything that isn't explicitly stated. Format your response using the field numbers from the list above, like this:
<name of first field, *verbatim*, including the parenthetical>: <value of first field>
<name of second field, *verbatim*, including the parenthetical>: <value of second field>
...
<name of last field, *verbatim*, including the parenthetical>: <value of last field>

Do not include any other text in your response (introductions, justifications, bullet points or line numbers, etc.)
"""

def extract_fields(text: str) -> list[tuple[str, Optional[str]]]:
    """
    Extract fields from text using OpenAI API
    :param text: text from which to extract fields
    :return: list of (field, response) tuples, where response is either an LLM-generated paraphrase or None
    """
    def validate_and_process(response_content: str) -> list[tuple[str, Optional[str]]]:
        field_response_pairs = []  # list of (field, response) tuples
        for i, (field, response_line) in enumerate(zip(fields_for_extraction, response_content.split("\n"))):
            response_field = response_line.split(":")[0].strip()
            if response_field != field:
                raise ValueError(f"Response field {response_field} does not match expected field {field}")
            response = response_line.removeprefix(f"{field}:").strip()
            if response.lower() == "n/a":
                response = None
            field_response_pairs.append((field, response))
        return field_response_pairs

    prompt = extract_fields_prompt.format(fields=fields_for_extraction, submitted_text=text)
    return open_ai_llm_call(prompt, model="gpt-4o", max_retries=1, validate_and_process_fn=validate_and_process)

def user_can_perform_limited_action(
        user_actions: dict,
        action_identifier: str,
        time_limit_hours: float,
        action_limit: int
) -> tuple[bool, dict]:
    """
    Check if a user can perform a limited action
    :param user_actions: dict mapping action identifier to list of timestamps; stored in user_json
    :param action_identifier: string identifier for the action
    :param time_limit_hours: number of hours
    :param action_limit: number of actions
    :return: (can_perform, new_user_actions), where new_user_actions excludes timestamps older than time_limit_hours
    """
    action_timestamps = user_actions.setdefault(action_identifier, [])
    current_time = datetime.now(timezone.utc)
    recent_timestamps = [t for t in action_timestamps if t > (current_time - timedelta(hours=time_limit_hours))]

    new_user_actions = dict(user_actions)
    new_user_actions[action_identifier] = recent_timestamps

    if len(recent_timestamps) >= action_limit:
        return False, new_user_actions

    return True, new_user_actions