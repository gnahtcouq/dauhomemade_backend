import envConfig from '@/config'
import { PrismaErrorCode } from '@/constants/error-reference'
import { Role, TableStatus } from '@/constants/type'
import prisma from '@/database'
import {
  ChangePasswordBodyType,
  CreateEmployeeAccountBodyType,
  CreateGuestBodyType,
  UpdateEmployeeAccountBodyType,
  UpdateMeBodyType
} from '@/schemaValidations/account.schema'
import { comparePassword, hashPassword } from '@/utils/crypto'
import { EntityError } from '@/utils/errors'
import { getChalk } from '@/utils/helpers'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/react-native.js'

export const initOwnerAccount = async () => {
  const accountCount = await prisma.account.count()
  if (accountCount === 0) {
    const hashedPassword = await hashPassword(envConfig.INITIAL_PASSWORD_OWNER)
    await prisma.account.create({
      data: {
        name: 'Owner',
        email: envConfig.INITIAL_EMAIL_OWNER,
        password: hashedPassword,
        role: Role.Owner
      }
    })
    const chalk = await getChalk()
    console.log(
      chalk.bgCyan(
        `Khởi tạo tài khoản chủ quán thành công: ${envConfig.INITIAL_EMAIL_OWNER}|${envConfig.INITIAL_PASSWORD_OWNER}`
      )
    )
  }
}

export const createEmployeeAccount = async (body: CreateEmployeeAccountBodyType) => {
  try {
    // Kiểm tra xem email đã tồn tại hay chưa
    const existingEmail = await prisma.account.findUnique({
      where: { email: body.email }
    })

    if (existingEmail) {
      throw new EntityError([
        {
          message: 'Email này đã tồn tại',
          field: 'email'
        }
      ])
    }
    const hashedPassword = await hashPassword(body.password)
    const account = await prisma.account.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: Role.Employee,
        avatar: body.avatar
      }
    })
    return account
  } catch (error: any) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorCode.UniqueConstraintViolation) {
        throw new EntityError([{ field: 'email', message: 'Email này đã tồn tại' }])
      }
    }
    throw error
  }
}

export const getEmployeeAccounts = async () => {
  const accounts = await prisma.account.findMany({
    where: {
      role: Role.Employee
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
  return accounts
}

export const getEmployeeAccount = async (accountId: number) => {
  const account = await prisma.account.findUniqueOrThrow({
    where: {
      id: accountId
    }
  })
  return account
}

export const getAccountList = async () => {
  const account = await prisma.account.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  })
  return account
}

export const updateEmployeeAccount = async (accountId: number, body: UpdateEmployeeAccountBodyType) => {
  try {
    // Kiểm tra xem email đã tồn tại hay chưa
    const existingEmail = await prisma.account.findUnique({
      where: { email: body.email }
    })

    if (existingEmail) {
      throw new EntityError([
        {
          message: 'Email này đã tồn tại',
          field: 'email'
        }
      ])
    }
    const socketRecord = await prisma.socket.findUnique({
      where: {
        accountId
      }
    })
    const socketId = socketRecord ? socketRecord.socketId : null

    if (body.changePassword) {
      const hashedPassword = await hashPassword(body.password!)
      const account = await prisma.account.update({
        where: {
          id: accountId
        },
        data: {
          name: body.name,
          email: body.email,
          avatar: body.avatar,
          role: body.role,
          password: hashedPassword
        }
      })
      const isChangeRole = account.role !== body.role
      return { account, socketId, isChangeRole }
    } else {
      const account = await prisma.account.update({
        where: {
          id: accountId
        },
        data: {
          name: body.name,
          email: body.email,
          avatar: body.avatar,
          role: body.role
        }
      })

      const isChangeRole = account.role !== body.role
      return { account, socketId, isChangeRole }
    }
  } catch (error: any) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorCode.UniqueConstraintViolation) {
        throw new EntityError([{ field: 'email', message: 'Email đã tồn tại' }])
      }
    }
    throw error
  }
}

export const deleteEmployeeAccount = async (accountId: number) => {
  const socketRecord = await prisma.socket.findUnique({
    where: {
      accountId
    }
  })
  const socketId = socketRecord ? socketRecord.socketId : null

  const account = await prisma.account.delete({
    where: {
      id: accountId
    }
  })

  return { account, socketId }
}

export const getMeController = async (accountId: number) => {
  const account = prisma.account.findUniqueOrThrow({
    where: {
      id: accountId
    }
  })
  return account
}

export const updateMeController = async (accountId: number, body: UpdateMeBodyType) => {
  const account = prisma.account.update({
    where: {
      id: accountId
    },
    data: body
  })
  return account
}

export const changePasswordController = async (accountId: number, body: ChangePasswordBodyType) => {
  const account = await prisma.account.findUniqueOrThrow({
    where: {
      id: accountId
    }
  })
  const isSame = await comparePassword(body.oldPassword, account.password)
  if (!isSame) {
    throw new EntityError([{ field: 'oldPassword', message: 'Mật khẩu cũ không đúng' }])
  }
  const hashedPassword = await hashPassword(body.password)
  const newAccount = await prisma.account.update({
    where: {
      id: accountId
    },
    data: {
      password: hashedPassword
    }
  })
  return newAccount
}

export const getGuestList = async ({ fromDate, toDate }: { fromDate?: Date; toDate?: Date }) => {
  const orders = await prisma.guest.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    where: {
      createdAt: {
        gte: fromDate,
        lte: toDate
      }
    }
  })
  return orders
}

export const createGuestController = async (body: CreateGuestBodyType) => {
  const table = await prisma.table.findUnique({
    where: {
      number: body.tableNumber
    }
  })
  if (!table) {
    throw new Error('Bàn không tồn tại')
  }

  if (table.status === TableStatus.Hidden) {
    throw new Error(`Bàn ${table.number} đã bị ẩn, vui lòng chọn bàn khác`)
  }
  const guest = await prisma.guest.create({
    data: body
  })
  return guest
}
