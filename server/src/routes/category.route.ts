import {
  createCategory,
  deleteCategory,
  getCategoryDetail,
  getCategoryList,
  updateCategory
} from '@/controllers/category.controller'
import { requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  CategoryListRes,
  CategoryListResType,
  CategoryParams,
  CategoryParamsType,
  CategoryRes,
  CategoryResType,
  CreateCategoryBody,
  CreateCategoryBodyType,
  UpdateCategoryBody,
  UpdateCategoryBodyType
} from '@/schemaValidations/category.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function categoryRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get<{
    Reply: CategoryListResType
  }>(
    '/',
    {
      schema: {
        response: {
          200: CategoryListRes
        }
      }
    },
    async (request, reply) => {
      const categories = await getCategoryList()
      reply.send({
        data: categories as CategoryListResType['data'],
        message: 'Lấy danh sách danh mục thành công!'
      })
    }
  )

  fastify.get<{
    Params: CategoryParamsType
    Reply: CategoryResType
  }>(
    '/:id',
    {
      schema: {
        params: CategoryParams,
        response: {
          200: CategoryRes
        }
      }
    },
    async (request, reply) => {
      const dish = await getCategoryDetail(request.params.id)
      reply.send({
        data: dish as CategoryResType['data'],
        message: 'Lấy thông tin danh mục thành công!'
      })
    }
  )

  fastify.post<{
    Body: CreateCategoryBodyType
    Reply: CategoryResType
  }>(
    '',
    {
      schema: {
        body: CreateCategoryBody,
        response: {
          200: CategoryRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook]])
    },
    async (request, reply) => {
      const dish = await createCategory(request.body)
      reply.send({
        data: dish as CategoryResType['data'],
        message: 'Tạo danh mục thành công!'
      })
    }
  )

  fastify.put<{
    Params: CategoryParamsType
    Body: UpdateCategoryBodyType
    Reply: CategoryResType
  }>(
    '/:id',
    {
      schema: {
        params: CategoryParams,
        body: UpdateCategoryBody,
        response: {
          200: CategoryRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook]])
    },
    async (request, reply) => {
      const category = await updateCategory(request.params.id, request.body)
      reply.send({
        data: category as CategoryResType['data'],
        message: 'Cập nhật danh mục thành công!'
      })
    }
  )

  fastify.delete<{
    Params: CategoryParamsType
    Reply: CategoryResType
  }>(
    '/:id',
    {
      schema: {
        params: CategoryParams,
        response: {
          200: CategoryRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook]])
    },
    async (request, reply) => {
      const result = await deleteCategory(request.params.id)
      reply.send({
        message: 'Xóa danh mục thành công!',
        data: result as CategoryResType['data']
      })
    }
  )
}
