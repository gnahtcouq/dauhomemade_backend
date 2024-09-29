import prisma from '@/database'
import { CreateCategoryBodyType, UpdateCategoryBodyType } from '@/schemaValidations/category.schema'

export const getCategoryList = async () => {
  const categories = await prisma.category.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  })
  return categories
}

export const getCategoryDetail = (id: number) => {
  return prisma.category.findUniqueOrThrow({
    where: {
      id
    }
  })
}

export const createCategory = async (data: CreateCategoryBodyType) => {
  return prisma.category.create({
    data: {
      name: data.name
    }
  })
}

export const updateCategory = (id: number, data: UpdateCategoryBodyType) => {
  return prisma.category.update({
    where: {
      id
    },
    data
  })
}

export const deleteCategory = (id: number) => {
  return prisma.category.delete({
    where: {
      id
    }
  })
}
