import prisma from '@/database'
import { CreateCategoryBodyType, UpdateCategoryBodyType } from '@/schemaValidations/category.schema'

export const getCategoryList = async () => {
  const categories = await prisma.category.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      dishes: true
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

export const deleteCategory = async (id: number) => {
  const dishes = await prisma.dish.findMany({
    where: {
      categoryId: id
    }
  })

  if (dishes.length > 0) {
    throw new Error('Không thể xoá danh mục vì vẫn còn món ăn trong danh mục này')
  }

  return prisma.category.delete({
    where: {
      id
    }
  })
}
