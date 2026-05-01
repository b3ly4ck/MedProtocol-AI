from pydantic import create_model


class BaseMedicalField:
    def __init__(self, data):
        self.id = data.get("id")
        self.key = data.get("key")
        self.label = data.get("label")
        self.field_type = data.get("field_type")
        self.required = data.get("required", False)
        self.value = data.get("value")

    def serialize(self):
        result = {}
        result["id"] = self.id
        result["key"] = self.key
        result["label"] = self.label
        result["field_type"] = self.field_type
        result["required"] = self.required
        return result

    def validate_schema(self):
        if not self.key:
            return False
        if not self.label:
            return False
        if self.field_type not in ["string", "number", "boolean", "date"]:
            return False
        return True


class Section:
    def __init__(self, data):
        self.id = data.get("id")
        self.title = data.get("title", "Section")
        self.fields = []

        raw_fields = data.get("fields", [])
        for item in raw_fields:
            field = BaseMedicalField(item)
            self.fields.append(field)

    def serialize(self):
        result = {}
        result["id"] = self.id
        result["title"] = self.title
        result["fields"] = []

        for field in self.fields:
            result["fields"].append(field.serialize())

        return result

    def validate_schema(self):
        if not self.title:
            return False
        if len(self.fields) == 0:
            return False

        for field in self.fields:
            ok = field.validate_schema()
            if not ok:
                return False

        return True


class Protocol:
    def __init__(self, data):
        self.id = data.get("id")
        self.name = data.get("name")
        self.specialty = data.get("specialty", "general")
        self.sections = []

        raw_sections = data.get("sections", [])
        for item in raw_sections:
            section = Section(item)
            self.sections.append(section)

    def serialize(self):
        result = {}
        result["id"] = self.id
        result["name"] = self.name
        result["specialty"] = self.specialty
        result["sections"] = []

        for section in self.sections:
            result["sections"].append(section.serialize())

        return result

    def validate_schema(self):
        if not self.name:
            return False
        if len(self.sections) == 0:
            return False

        keys = []
        for section in self.sections:
            ok = section.validate_schema()
            if not ok:
                return False

            for field in section.fields:
                if field.key in keys:
                    return False
                keys.append(field.key)

        return True

    def get_fields(self):
        result = []
        for section in self.sections:
            for field in section.fields:
                result.append(field)
        return result


def make_protocol(data):
    protocol = Protocol(data)
    ok = protocol.validate_schema()
    if not ok:
        raise ValueError("bad protocol")
    return protocol


def make_payload_model(protocol):
    fields = {}
    all_fields = protocol.get_fields()

    for field in all_fields:
        field_type = str
        if field.field_type == "number":
            field_type = float
        if field.field_type == "boolean":
            field_type = bool
        if field.field_type == "date":
            field_type = str

        default = None
        if field.required:
            default = ...

        fields[field.key] = (field_type, default)

    return create_model("ProtocolPayload", **fields)


def check_payload(protocol, data):
    Model = make_payload_model(protocol)
    item = Model.model_validate(data)
    return item.model_dump()
