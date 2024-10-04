import prisma from '@/database'
import { CreateTableBodyType, UpdateTableBodyType } from '@/schemaValidations/table.schema'
import { EntityError } from '@/utils/errors'
import { randomId } from '@/utils/helpers'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/react-native.js'

export const getTableList = () => {
  return prisma.table.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  })
}

export const getTableDetail = (number: number) => {
  return prisma.table.findUniqueOrThrow({
    where: {
      number
    }
  })
}

export const createTable = async (data: CreateTableBodyType) => {
  const token = randomId()
  try {
    if (data.number > 2147483647) {
      throw new EntityError([
        {
          message: 'Số bàn không hợp lệ',
          field: 'number'
        }
      ])
    }

    // Kiểm tra xem số bàn đã tồn tại hay chưa
    const existingTable = await prisma.table.findUnique({
      where: { number: data.number }
    })

    if (existingTable) {
      throw new EntityError([
        {
          message: 'Số bàn này đã tồn tại',
          field: 'number'
        }
      ])
    }

    const result = await prisma.table.create({
      data: {
        ...data,
        token
      }
    })
    return result
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new EntityError([
          {
            message: 'Số bàn này đã tồn tại',
            field: 'number'
          }
        ])
      }
    }
    throw error
  }
}

export const updateTable = (number: number, data: UpdateTableBodyType) => {
  if (data.changeToken) {
    const token = randomId()
    // Xóa hết các refresh token của guest theo table
    return prisma.$transaction(async (tx) => {
      const [table] = await Promise.all([
        tx.table.update({
          where: {
            number
          },
          data: {
            status: data.status,
            capacity: data.capacity,
            token
          }
        }),
        tx.guest.updateMany({
          where: {
            tableNumber: number
          },
          data: {
            refreshToken: null,
            refreshTokenExpiresAt: null
          }
        })
      ])
      return table
    })
  }
  return prisma.table.update({
    where: {
      number
    },
    data: {
      status: data.status,
      capacity: data.capacity
    }
  })
}

export const deleteTable = (number: number) => {
  return prisma.table.delete({
    where: {
      number
    }
  })
}
