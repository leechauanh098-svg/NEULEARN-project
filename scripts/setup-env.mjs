import { copyFileSync, constants } from "node:fs"
import { fileURLToPath } from "node:url"

const templatePath = fileURLToPath(new URL("../.env.example", import.meta.url))
const envPath = fileURLToPath(new URL("../.env.local", import.meta.url))

try {
  copyFileSync(templatePath, envPath, constants.COPYFILE_EXCL)
  console.log("Created .env.local from .env.example. Fill in your Supabase settings before running the app.")
} catch (error) {
  if (error.code === "EEXIST") {
    console.error(".env.local already exists; it was left unchanged.")
    process.exitCode = 1
  } else {
    throw error
  }
}
