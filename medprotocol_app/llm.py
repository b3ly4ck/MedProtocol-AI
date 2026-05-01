import json
import os

import httpx


class PromptContainer:
    def __init__(self):
        self.prompts = {}

    def add_prompt(self, name, text):
        self.prompts[name] = text

    def get_prompt(self, name):
        if name in self.prompts:
            return self.prompts[name]
        return self.prompts.get("default")


class ToolRegistry:
    def __init__(self):
        self.tools = {}

    def add_tool(self, name, func):
        self.tools[name] = func

    def get_tool(self, name):
        return self.tools.get(name)


def get_normal_ranges(age):
    if age < 18:
        return "child ranges"
    return "adult ranges"


prompts = PromptContainer()
tools = ToolRegistry()

prompts.add_prompt(
    "default",
    "Check medical protocol JSON. Return JSON with issues list.",
)
tools.add_tool("get_normal_ranges", get_normal_ranges)


def parse_validation(text):
    try:
        data = json.loads(text)
    except:
        return []

    result = []
    items = data.get("issues", [])
    for item in items:
        error = {}
        error["field_id"] = item.get("field_id")
        error["message"] = item.get("message", "")
        error["severity"] = item.get("severity", "warning")
        result.append(error)

    return result


def fake_check(protocol, payload):
    result = []
    fields = protocol.get_fields()

    for field in fields:
        if field.required:
            value = payload.get(field.key)
            if value is None:
                item = {}
                item["field_id"] = field.id
                item["message"] = "required field is empty"
                item["severity"] = "error"
                result.append(item)

    return result


async def run_llm_check(protocol, payload):
    dry_run = os.getenv("LLM_DRY_RUN", "false")
    if dry_run == "true":
        return fake_check(protocol, payload)

    api_key = os.getenv("LLM_API_KEY", "")
    if not api_key:
        return fake_check(protocol, payload)

    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com")
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    prompt = prompts.get_prompt(protocol.specialty)

    url = base_url.rstrip("/")
    if not url.endswith("/v1"):
        url = url + "/v1"
    url = url + "/chat/completions"

    body = {}
    body["model"] = model
    body["messages"] = []
    body["messages"].append({"role": "system", "content": prompt})
    body["messages"].append({"role": "user", "content": json.dumps(payload)})
    body["response_format"] = {"type": "json_object"}

    headers = {}
    headers["Authorization"] = "Bearer " + api_key

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, json=body, headers=headers)
            response.raise_for_status()
            answer = response.json()
    except:
        return fake_check(protocol, payload)

    choices = answer.get("choices", [])
    if len(choices) == 0:
        return []

    message = choices[0].get("message", {})
    content = message.get("content", "")
    return parse_validation(content)
