import { loginController, logoutController, refreshTokenController } from '@/controllers/auth.controller'
import { requireLoginedHook } from '@/hooks/auth.hooks'
import {
  LoginBody,
  LoginBodyType,
  LoginRes,
  LoginResType,
  LogoutBody,
  LogoutBodyType,
  RefreshTokenBody,
  RefreshTokenBodyType,
  RefreshTokenRes,
  RefreshTokenResType
} from '@/schemaValidations/auth.schema'
import { MessageRes, MessageResType } from '@/schemaValidations/common.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function authRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post<{ Reply: MessageResType; Body: LogoutBodyType }>(
    '/logout',
    {
      schema: {
        response: {
          200: MessageRes
        },
        body: LogoutBody
      },
      preValidation: fastify.auth([requireLoginedHook])
    },
    async (request, reply) => {
      const message = await logoutController(request.body.refreshToken)
      reply.send({
        message
      })
    }
  )
  fastify.post<{ Reply: LoginResType; Body: LoginBodyType }>(
    '/login',
    {
      schema: {
        response: {
          200: LoginRes
        },
        body: LoginBody
      }
    },
    async (request, reply) => {
      const { body } = request
      const { accessToken, refreshToken, account } = await loginController(body)
      reply.send({
        message: 'Đăng nhập thành công',
        data: {
          account: account as LoginResType['data']['account'],
          accessToken,
          refreshToken
        }
      })
    }
  )
  fastify.post<{
    Reply: RefreshTokenResType
    Body: RefreshTokenBodyType
  }>(
    '/refresh-token',
    {
      schema: {
        response: {
          200: RefreshTokenRes
        },
        body: RefreshTokenBody
      }
    },
    async (request, reply) => {
      const result = await refreshTokenController(request.body.refreshToken)
      reply.send({
        message: 'Lấy token mới thành công',
        data: result
      })
    }
  )
}
