import fs from 'fs'
import path from 'path'
import z from 'zod'
import { config } from 'dotenv'

config({
  path: '.env'
})

const checkEnv = async () => {
  const chalk = (await import('chalk')).default
  if (!fs.existsSync(path.resolve('.env'))) {
    console.log(chalk.red(`Không tìm thấy file môi trường .env`))
    process.exit(1)
  }
}
checkEnv()

const configSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  ACCESS_TOKEN_EXPIRES_IN: z.string(),
  GUEST_ACCESS_TOKEN_EXPIRES_IN: z.string(),
  GUEST_REFRESH_TOKEN_EXPIRES_IN: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),
  INITIAL_EMAIL_OWNER: z.string(),
  INITIAL_PASSWORD_OWNER: z.string(),
  DOMAIN: z.string(),
  PROTOCOL: z.string(),
  UPLOAD_FOLDER: z.string(),
  CLIENT_URL: z.string(),
  BACKEND_URL: z.string(),
  ZP_APP_ID: z.string(),
  ZP_KEY1: z.string(),
  ZP_KEY2: z.string(),
  ZP_CREATE_ORDER: z.string(),
  ZP_CHECK_STATUS: z.string(),
  ZP_REDIRECT_URL: z.string(),
  ZP_CALLBACK_URL: z.string()
})

const configServer = configSchema.safeParse(process.env)

if (!configServer.success) {
  console.error(configServer.error.issues)
  throw new Error('Các giá trị khai báo trong file .env không hợp lệ')
}
const envConfig = configServer.data
export const API_URL = `${envConfig.PROTOCOL}://${envConfig.DOMAIN}:${envConfig.PORT}`
export const API_BACKEND_URL = envConfig.BACKEND_URL
export default envConfig

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof configSchema> {}
  }
}
