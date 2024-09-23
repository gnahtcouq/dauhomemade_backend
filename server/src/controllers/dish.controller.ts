import prisma from '@/database'
import { CreateDishBodyType, UpdateDishBodyType } from '@/schemaValidations/dish.schema'

export const getDishList = () => {
  return prisma.dish.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  })
}

export const getDishDetail = (id: number) => {
  return prisma.dish.findUniqueOrThrow({
    where: {
      id
    }
  })
}

export const createDish = (data: CreateDishBodyType) => {
  return prisma.dish.create({
    data
  })
}

export const updateDish = (id: number, data: UpdateDishBodyType) => {
  return prisma.dish.update({
    where: {
      id
    },
    data
  })
}

export const deleteDish = (id: number) => {
  return prisma.dish.delete({
    where: {
      id
    }
  })
}
