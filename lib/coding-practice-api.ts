import javaExercisesData from "./data/java-exercises.json"

export type TaskValidation = {
  type: "regex" | "contains"
  pattern?: string
  forbiddenPattern?: string
  errorMessage?: string
}

export type CodingTask = {
  id: number
  title?: string
  text: string
  hint: string | null
  validation?: TaskValidation
}

export type CodingExercise = {
  id: string
  course: string
  title: string
  subtitle?: string
  fileName: string
  lesson: string
  starterCode: string
  solutionCode: string
  solutionExplanation: string
  defaultOutput: string
  tasks: CodingTask[]
}

export type CheckResult = {
  passed: number[]
  failed: number[]
  allDone: boolean
  simulatedOutput: string
  feedback: string
  taskErrors?: Record<number, string>
}

export const staticJavaExercises: CodingExercise[] = javaExercisesData as CodingExercise[]

export async function fetchJavaExercises(_token?: string): Promise<CodingExercise[]> {
  try {
    const res = await fetch("/data/java-exercises.json")
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return data as CodingExercise[]
      }
    }
  } catch {
    // fallback static import
  }
  return staticJavaExercises
}

export function evaluateJavaCode(code: string, exercise: CodingExercise): CheckResult {
  const passed: number[] = []
  const failed: number[] = []
  const taskErrors: Record<number, string> = {}

  for (const task of exercise.tasks) {
    const val = task.validation
    if (!val) {
      passed.push(task.id)
      continue
    }

    // Check forbidden pattern first
    if (val.forbiddenPattern) {
      const forbiddenRegex = new RegExp(val.forbiddenPattern, "i")
      if (forbiddenRegex.test(code)) {
        failed.push(task.id)
        taskErrors[task.id] = val.errorMessage ?? "Code chứa cú pháp không được phép cho bài này."
        continue
      }
    }

    // Check required pattern
    if (val.pattern) {
      const regex = new RegExp(val.pattern, "i")
      if (regex.test(code)) {
        passed.push(task.id)
      } else {
        failed.push(task.id)
        taskErrors[task.id] = val.errorMessage ?? (task.hint ? `Gợi ý: ${task.hint}` : "Chưa hoàn thành yêu cầu.")
      }
    } else {
      passed.push(task.id)
    }
  }

  const allDone = passed.length === exercise.tasks.length

  // Simulate console output based on student's print statements or fallback
  let simulatedOutput = ""
  if (allDone) {
    simulatedOutput = extractSimulatedOutput(code, exercise.defaultOutput)
  } else {
    simulatedOutput = extractSimulatedOutput(code, "")
  }

  const feedback = allDone
    ? "Tuyệt vời! Bạn đã hoàn thành tất cả các yêu cầu của bài học."
    : `Đã hoàn thành ${passed.length}/${exercise.tasks.length} task. Hãy kiểm tra các task chưa đạt.`

  return {
    passed,
    failed,
    allDone,
    simulatedOutput,
    feedback,
    taskErrors,
  }
}

function extractSimulatedOutput(code: string, defaultOutput: string): string {
  // Extract values if defined
  const nameMatch = code.match(/String\s+name\s*=\s*"([^"]*)"/i)
  const ageMatch = code.match(/int\s+age\s*=\s*(\d+)/i)
  const salaryMatch = code.match(/double\s+desiredSalary\s*=\s*([\d.]+)/i)
  const mystery2Match = code.match(/int\s+mystery2\s*=\s*8\s*-\s*6/i)

  const studentName = nameMatch ? nameMatch[1] : "Sinh Viên"
  const studentAge = ageMatch ? ageMatch[1] : "20"
  const studentSalary = salaryMatch ? salaryMatch[1] : "2000.5"

  // Check println calls
  const printRegex = /System\.out\.println\s*\(([\s\S]*?)\)\s*;/g
  const outputs: string[] = []
  let match: RegExpExecArray | null

  while ((match = printRegex.exec(code)) !== null) {
    const rawArg = match[1].trim()
    let rendered = rawArg

    // Replace variable names or expressions
    if (mystery2Match && rawArg.includes("mystery2")) {
      rendered = "2"
    } else {
      rendered = rendered
        .replace(/\bname\b/g, `"${studentName}"`)
        .replace(/\bage\b/g, studentAge)
        .replace(/\bdesiredSalary\b/g, studentSalary)

      // Evaluate simple string concatenation: "Tên: " + "Châu Anh"
      const parts = rendered.split("+").map((p) => p.trim())
      const evaluated = parts
        .map((p) => {
          if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
            return p.slice(1, -1)
          }
          return p
        })
        .join("")
      rendered = evaluated
    }
    outputs.push(rendered)
  }

  if (outputs.length > 0) {
    return outputs.join("\n")
  }

  return defaultOutput
}
