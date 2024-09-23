import { Role } from '@/constants/type'
import {
  changePasswordController,
  createEmployeeAccount,
  createGuestController,
  deleteEmployeeAccount,
  getAccountList,
  getEmployeeAccount,
  getGuestList,
  getMeController,
  updateEmployeeAccount,
  updateMeController
} from '@/controllers/account.controller'
import { requireEmployeeHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  AccountIdParam,
  AccountIdParamType,
  AccountListRes,
  AccountListResType,
  AccountRes,
  AccountResType,
  ChangePasswordBody,
  ChangePasswordBodyType,
  CreateEmployeeAccountBody,
  CreateEmployeeAccountBodyType,
  CreateGuestBody,
  CreateGuestBodyType,
  CreateGuestRes,
  CreateGuestResType,
  GetGuestListQueryParams,
  GetGuestListQueryParamsType,
  GetListGuestsRes,
  GetListGuestsResType,
  UpdateEmployeeAccountBody,
  UpdateEmployeeAccountBodyType,
  UpdateMeBody,
  UpdateMeBodyType
} from '@/schemaValidations/account.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function accountRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook('preValidation', fastify.auth([requireLoginedHook]))
  fastify.get<{ Reply: AccountListResType }>(
    '/',
    {
      schema: {
        response: {
          200: AccountListRes
        }
      },
      preValidation: fastify.auth([requireOwnerHook])
    },
    async (request, reply) => {
      const accounts = await getAccountList()
      reply.send({
        data: accounts as AccountListResType['data'],
        message: 'Lấy danh sách nhân viên thành công!'
      })
    }
  )
  fastify.post<{
    Body: CreateEmployeeAccountBodyType
    Reply: AccountResType
  }>(
    '/',
    {
      schema: {
        response: {
          200: AccountRes
        },
        body: CreateEmployeeAccountBody
      },
      preValidation: fastify.auth([requireOwnerHook])
    },
    async (request, reply) => {
      const account = await createEmployeeAccount(request.body)
      reply.send({
        data: account as AccountResType['data'],
        message: 'Tạo tài khoản thành công!'
      })
    }
  )
  fastify.get<{ Reply: AccountResType; Params: AccountIdParamType }>(
    '/detail/:id',
    {
      schema: {
        response: {
          200: AccountRes
        },
        params: AccountIdParam
      },
      preValidation: fastify.auth([requireOwnerHook])
    },
    async (request, reply) => {
      const accountId = request.params.id
      const account = await getEmployeeAccount(accountId)
      reply.send({
        data: account as AccountResType['data'],
        message: 'Lấy thông tin nhân viên thành công!'
      })
    }
  )

  fastify.put<{ Reply: AccountResType; Params: AccountIdParamType; Body: UpdateEmployeeAccountBodyType }>(
    '/detail/:id',
    {
      schema: {
        response: {
          200: AccountRes
        },
        params: AccountIdParam,
        body: UpdateEmployeeAccountBody
      },
      preValidation: fastify.auth([requireOwnerHook])
    },
    async (request, reply) => {
      const accountId = request.params.id
      const body = request.body
      const { account, socketId, isChangeRole } = await updateEmployeeAccount(accountId, body)
      if (isChangeRole && socketId) {
        fastify.io.to(socketId).emit('refresh-token', account)
      }
      reply.send({
        data: account as AccountResType['data'],
        message: 'Cập nhật thành công!'
      })
    }
  )

  fastify.delete<{ Reply: AccountResType; Params: AccountIdParamType }>(
    '/detail/:id',
    {
      schema: {
        response: {
          200: AccountRes
        },
        params: AccountIdParam
      },
      preValidation: fastify.auth([requireOwnerHook])
    },
    async (request, reply) => {
      const accountId = request.params.id
      const { account, socketId } = await deleteEmployeeAccount(accountId)
      if (socketId) {
        fastify.io.to(socketId).emit('logout', account)
      }
      reply.send({
        data: account as AccountResType['data'],
        message: 'Xóa thành công!'
      })
    }
  )

  fastify.get<{ Reply: AccountResType }>(
    '/me',
    {
      schema: {
        response: {
          200: AccountRes
        }
      }
    },
    async (request, reply) => {
      const account = await getMeController(request.decodedAccessToken?.userId as number)
      reply.send({
        data: account as AccountResType['data'],
        message: 'Lấy thông tin thành công!'
      })
    }
  )

  fastify.put<{
    Reply: AccountResType
    Body: UpdateMeBodyType
  }>(
    '/me',
    {
      schema: {
        response: {
          200: AccountRes
        },
        body: UpdateMeBody
      }
    },
    async (request, reply) => {
      const result = await updateMeController(request.decodedAccessToken?.userId as number, request.body)
      reply.send({
        data: result as AccountResType['data'],
        message: 'Cập nhật thông tin thành công!'
      })
    }
  )

  fastify.put<{
    Reply: AccountResType
    Body: ChangePasswordBodyType
  }>(
    '/change-password',
    {
      schema: {
        response: {
          200: AccountRes
        },
        body: ChangePasswordBody
      }
    },
    async (request, reply) => {
      const result = await changePasswordController(request.decodedAccessToken?.userId as number, request.body)
      reply.send({
        data: result as AccountResType['data'],
        message: 'Đổi mật khẩu thành công!'
      })
    }
  )

  fastify.post<{ Reply: CreateGuestResType; Body: CreateGuestBodyType }>(
    '/guests',
    {
      schema: {
        response: {
          200: CreateGuestRes
        },
        body: CreateGuestBody
      },
      preValidation: fastify.auth([requireOwnerHook])
    },
    async (request, reply) => {
      const result = await createGuestController(request.body)
      reply.send({
        message: 'Tạo tài khoản khách thành công!',
        data: { ...result, role: Role.Guest } as CreateGuestResType['data']
      })
    }
  )
  fastify.get<{ Reply: GetListGuestsResType; Querystring: GetGuestListQueryParamsType }>(
    '/guests',
    {
      schema: {
        response: {
          200: GetListGuestsRes
        },
        querystring: GetGuestListQueryParams
      },
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const result = await getGuestList({
        fromDate: request.query.fromDate,
        toDate: request.query.toDate
      })
      reply.send({
        message: 'Lấy danh sách khách thành công!',
        data: result as GetListGuestsResType['data']
      })
    }
  )
}
