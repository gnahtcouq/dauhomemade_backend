import { ManagerRoom, Role } from '@/constants/type'
import {
  createOrdersController,
  getOrderDetailController,
  getOrdersController,
  payOrdersController,
  updateOrderController
} from '@/controllers/order.controller'
import { requireEmployeeHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  CreateOrdersBody,
  CreateOrdersBodyType,
  CreateOrdersRes,
  CreateOrdersResType,
  GetOrderDetailRes,
  GetOrderDetailResType,
  GetOrdersQueryParams,
  GetOrdersQueryParamsType,
  GetOrdersRes,
  GetOrdersResType,
  OrderParam,
  OrderParamType,
  PayGuestOrdersBody,
  PayGuestOrdersBodyType,
  PayGuestOrdersRes,
  PayGuestOrdersResType,
  UpdateOrderBody,
  UpdateOrderBodyType,
  UpdateOrderRes,
  UpdateOrderResType
} from '@/schemaValidations/order.schema'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function orderRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.addHook('preValidation', fastify.auth([requireLoginedHook]))
  fastify.post<{ Reply: CreateOrdersResType; Body: CreateOrdersBodyType }>(
    '/',
    {
      schema: {
        response: {
          200: CreateOrdersRes
        },
        body: CreateOrdersBody
      },
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const { socketId, orders } = await createOrdersController(
        request.decodedAccessToken?.userId as number,
        request.body
      )
      if (socketId) {
        fastify.io.to(ManagerRoom).to(socketId).emit('new-order', orders)
      } else {
        fastify.io.to(ManagerRoom).emit('new-order', orders)
      }
      reply.send({
        message: `Tạo thành công ${orders.length} đơn hàng cho khách hàng`,
        data: orders as CreateOrdersResType['data']
      })
    }
  )
  fastify.get<{ Reply: GetOrdersResType; Querystring: GetOrdersQueryParamsType }>(
    '/',
    {
      schema: {
        response: {
          200: GetOrdersRes
        },
        querystring: GetOrdersQueryParams
      },
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const result = await getOrdersController({
        fromDate: request.query.fromDate,
        toDate: request.query.toDate
      })
      reply.send({
        message: 'Lấy danh sách đơn hàng thành công',
        data: result as GetOrdersResType['data']
      })
    }
  )

  fastify.get<{ Reply: GetOrderDetailResType; Params: OrderParamType }>(
    '/:orderId',
    {
      schema: {
        response: {
          200: GetOrderDetailRes
        },
        params: OrderParam
      },
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const result = await getOrderDetailController(request.params.orderId)
      reply.send({
        message: 'Lấy đơn hàng thành công',
        data: result as GetOrderDetailResType['data']
      })
    }
  )

  fastify.put<{ Reply: UpdateOrderResType; Body: UpdateOrderBodyType; Params: OrderParamType }>(
    '/:orderId',
    {
      schema: {
        response: {
          200: UpdateOrderRes
        },
        body: UpdateOrderBody,
        params: OrderParam
      },
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const userRole = request.decodedAccessToken?.role // Giả sử bạn lưu vai trò trong token

      const currentOrder = await getOrderDetailController(request.params.orderId)

      // Kiểm tra vai trò
      if (userRole === Role.Employee && request.body.status !== currentOrder.status)
        return reply.status(403).send({
          message: 'Nhân viên không được phép thay đổi trạng thái đơn hàng',
          data: {} as any
        })

      const result = await updateOrderController(request.params.orderId, {
        ...request.body,
        orderHandlerId: request.decodedAccessToken?.userId as number
      })
      if (result.socketId) {
        fastify.io.to(result.socketId).to(ManagerRoom).emit('update-order', result.order)
      } else {
        fastify.io.to(ManagerRoom).emit('update-order', result.order)
      }
      reply.send({
        message: 'Cập nhật đơn hàng thành công',
        data: result.order as UpdateOrderResType['data']
      })
    }
  )

  fastify.post<{ Body: PayGuestOrdersBodyType; Reply: PayGuestOrdersResType }>(
    '/pay',
    {
      schema: {
        response: {
          200: PayGuestOrdersRes
        },
        body: PayGuestOrdersBody
      },
      preValidation: fastify.auth([requireOwnerHook])
    },
    async (request, reply) => {
      const result = await payOrdersController({
        guestId: request.body.guestId,
        orderHandlerId: request.decodedAccessToken?.userId as number
      })
      if (result.socketId) {
        fastify.io.to(result.socketId).to(ManagerRoom).emit('payment', result.orders)
      } else {
        fastify.io.to(ManagerRoom).emit('payment', result.orders)
      }
      reply.send({
        message: `Thanh toán thành công ${result.orders.length} đơn`,
        data: result.orders as PayGuestOrdersResType['data']
      })
    }
  )
}
