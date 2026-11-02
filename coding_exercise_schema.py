import re

from admin_api import AdminApiError

MAX_EXERCISES = 100
MAX_TASKS = 20
MAX_JSON_SIZE = 5 * 1024 * 1024
SUPPORTED_LANGUAGES = {"java"}


def _text(value, field, max_length, required=True):
    if not isinstance(value, str):
        raise AdminApiError(400, f"{field} phải là chuỗi.")
    value = value.strip()
    if required and not value:
        raise AdminApiError(400, f"{field} không được để trống.")
    if len(value) > max_length:
        raise AdminApiError(400, f"{field} không được dài quá {max_length} ký tự.")
    return value


def validate_exercise_payload(payload):
    if isinstance(payload, list):
        exercises = payload
        metadata = {}
    elif isinstance(payload, dict):
        exercises = payload.get("exercises")
        metadata = payload
        if not isinstance(exercises, list):
            raise AdminApiError(400, "JSON phải có thuộc tính exercises là một mảng.")
    else:
        raise AdminApiError(400, "JSON phải là một mảng hoặc object có thuộc tính exercises.")

    if not exercises or len(exercises) > MAX_EXERCISES:
        raise AdminApiError(400, f"Bộ đề phải có từ 1 đến {MAX_EXERCISES} bài.")

    normalized = []
    exercise_ids = set()
    for index, raw_exercise in enumerate(exercises, start=1):
        if not isinstance(raw_exercise, dict):
            raise AdminApiError(400, f"Bài ở vị trí {index} không hợp lệ.")
        exercise_id = _text(raw_exercise.get("id"), f"Mã bài ở vị trí {index}", 120)
        if exercise_id in exercise_ids:
            raise AdminApiError(400, f"Mã bài bị trùng: {exercise_id}.")
        exercise_ids.add(exercise_id)

        tasks = raw_exercise.get("tasks")
        if not isinstance(tasks, list) or not tasks or len(tasks) > MAX_TASKS:
            raise AdminApiError(400, f"Bài {exercise_id} phải có từ 1 đến {MAX_TASKS} nhiệm vụ.")
        task_ids = set()
        normalized_tasks = []
        for task_index, raw_task in enumerate(tasks, start=1):
            if not isinstance(raw_task, dict):
                raise AdminApiError(400, f"Nhiệm vụ {task_index} của bài {exercise_id} không hợp lệ.")
            task_id = raw_task.get("id")
            if type(task_id) is not int or task_id < 1:
                raise AdminApiError(400, f"Mã nhiệm vụ {task_index} của bài {exercise_id} không hợp lệ.")
            if task_id in task_ids:
                raise AdminApiError(400, f"Mã nhiệm vụ bị trùng trong bài {exercise_id}.")
            task_ids.add(task_id)
            task = dict(raw_task)
            task["title"] = _text(raw_task.get("title", ""), "Tiêu đề nhiệm vụ", 180, required=False)
            task["text"] = _text(raw_task.get("text"), "Nội dung nhiệm vụ", 2000)
            task["hint"] = _text(raw_task.get("hint", ""), "Gợi ý nhiệm vụ", 1000, required=False) or None
            validation = raw_task.get("validation")
            if validation is not None:
                if not isinstance(validation, dict):
                    raise AdminApiError(400, f"Validation của bài {exercise_id} không hợp lệ.")
                validation_type = validation.get("type")
                if validation_type not in {"regex", "contains"}:
                    raise AdminApiError(400, f"Loại validation của bài {exercise_id} không được hỗ trợ.")
                for pattern_key in ("pattern", "forbiddenPattern"):
                    if pattern_key in validation:
                        pattern = _text(validation[pattern_key], pattern_key, 1000)
                        if validation_type == "regex":
                            try:
                                re.compile(pattern)
                            except re.error as error:
                                raise AdminApiError(400, f"Regex {pattern_key} của bài {exercise_id} không hợp lệ.") from error
                        validation[pattern_key] = pattern
                task["validation"] = validation
            normalized_tasks.append(task)

        normalized_exercise = dict(raw_exercise)
        normalized_exercise["id"] = exercise_id
        normalized_exercise["course"] = _text(raw_exercise.get("course", ""), "Môn học", 180, required=False)
        normalized_exercise["title"] = _text(raw_exercise.get("title"), f"Tiêu đề bài {exercise_id}", 240)
        normalized_exercise["subtitle"] = _text(raw_exercise.get("subtitle", ""), "Phụ đề", 240, required=False) or None
        normalized_exercise["fileName"] = _text(raw_exercise.get("fileName"), f"Tên file của bài {exercise_id}", 180)
        normalized_exercise["lesson"] = _text(raw_exercise.get("lesson"), f"Nội dung bài {exercise_id}", 10000)
        normalized_exercise["starterCode"] = _text(raw_exercise.get("starterCode"), f"Mã khởi đầu của bài {exercise_id}", 30000)
        normalized_exercise["solutionCode"] = _text(raw_exercise.get("solutionCode"), f"Mã lời giải của bài {exercise_id}", 30000)
        normalized_exercise["solutionExplanation"] = _text(raw_exercise.get("solutionExplanation"), f"Giải thích của bài {exercise_id}", 10000)
        normalized_exercise["defaultOutput"] = _text(raw_exercise.get("defaultOutput", ""), "Kết quả mặc định", 5000, required=False)
        normalized_exercise["tasks"] = normalized_tasks
        normalized.append(normalized_exercise)

    language = _text(metadata.get("language", "java"), "Ngôn ngữ", 30).lower()
    if language not in SUPPORTED_LANGUAGES:
        raise AdminApiError(400, "Ngôn ngữ hiện tại chỉ hỗ trợ java.")
    return {"version": metadata.get("version", 1), "language": language, "exercises": normalized}
