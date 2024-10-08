import envConfig from '@/config'
import { ManagerRoom, OrderStatus, Role } from '@/constants/type'
import {
  callbackZaloPayController,
  createOrdersController,
  deleteAllNotificationsController,
  getNotificationsController,
  getOrderDetailController,
  getOrdersController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController,
  payOrdersController,
  payOrdersWithZaloPayController,
  updateOrderController
} from '@/controllers/order.controller'
import { requireEmployeeHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import {
  CreateOrdersBody,
  CreateOrdersBodyType,
  CreateOrdersRes,
  CreateOrdersResType,
  GetNotificationResType,
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
  UpdateNotificationResType,
  UpdateOrderBody,
  UpdateOrderBodyType,
  UpdateOrderRes,
  UpdateOrderResType,
  ZaloPayGuestOrdersResType
} from '@/schemaValidations/order.schema'
import axios from 'axios'
import CryptoJS from 'crypto-js'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import QueryString from 'qs'

export default async function orderRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post<{ Reply: CreateOrdersResType; Body: CreateOrdersBodyType }>(
    '/',
    {
      schema: {
        response: {
          200: CreateOrdersRes
        },
        body: CreateOrdersBody
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
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
        message: `Tạo thành công ${orders.length} đơn hàng cho khách hàng!`,
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
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const result = await getOrdersController({
        fromDate: request.query.fromDate,
        toDate: request.query.toDate
      })
      reply.send({
        message: 'Lấy danh sách đơn hàng thành công!',
        data: result as GetOrdersResType['data']
      })
    }
  )

  fastify.get<{ Reply: GetNotificationResType }>(
    '/notifications',
    {
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const notifications = await getNotificationsController()
      reply.send({
        message: 'Lấy danh sách thông báo thành công!',
        data: notifications
      })
    }
  )

  fastify.put<{ Params: { notificationId: number }; Reply: UpdateNotificationResType }>(
    '/notifications/:notificationId',
    {
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const notificationId = Number(request.params.notificationId)
      const notification = await markNotificationAsReadController(notificationId)
      reply.send({
        message: 'Đánh dấu thông báo là đã đọc thành công!',
        data: notification
      })
    }
  )

  fastify.delete<{ Reply: { message: string } }>(
    '/notifications',
    {
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const result = await deleteAllNotificationsController()
      reply.send(result)
    }
  )

  fastify.put<{ Reply: { message: string } }>(
    '/notifications/mark-all-read',
    {
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const result = await markAllNotificationsAsReadController()
      reply.send(result)
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
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const result = await getOrderDetailController(request.params.orderId)
      reply.send({
        message: 'Lấy đơn hàng thành công!',
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
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const userRole = request.decodedAccessToken?.role

      const currentOrder = await getOrderDetailController(request.params.orderId)

      // Kiểm tra trạng thái thanh toán
      if (currentOrder.status === OrderStatus.Paid) {
        return reply.status(403).send({
          message: 'Đơn hàng đã thanh toán, không thể chỉnh sửa hoặc thay đổi trạng thái',
          data: {} as any
        })
      }

      // Kiểm tra vai trò
      if (userRole === Role.Employee && request.body.status !== currentOrder.status)
        return reply.status(403).send({
          message: 'Bạn không có quyền thay đổi trạng thái đơn hàng',
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
        message: 'Cập nhật đơn hàng thành công!',
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
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook]])
    },
    async (request, reply) => {
      const userRole = request.decodedAccessToken?.role
      // Kiểm tra vai trò
      if (userRole === Role.Employee)
        return reply.status(403).send({
          message: 'Bạn không có quyền thanh toán đơn hàng',
          data: {} as any
        })

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
        message: `Thanh toán thành công ${result.orders.length} đơn!`,
        data: result.orders as PayGuestOrdersResType['data']
      })
    }
  )

  fastify.post<{ Body: PayGuestOrdersBodyType; Reply: ZaloPayGuestOrdersResType }>(
    '/zalopay',
    {
      preValidation: fastify.auth([requireLoginedHook])
    },
    async (request, reply) => {
      const result = await payOrdersWithZaloPayController({
        guestId: request.body.guestId
      })
      reply.send({
        message: `Gửi yêu cầu thanh toán ZaloPay với ${result.orders.length} đơn!`,
        data: {
          paymentUrl: result.paymentUrl,
          orders: result.orders
        }
      })
    }
  )

  fastify.post<{ Body: { data: string; mac: string } }>('/callback', async (request, reply) => {
    const result = await callbackZaloPayController(request.body)
    if (result.socketId) {
      fastify.io.to(result.socketId).to(ManagerRoom).emit('payment', result.orders)
    } else {
      fastify.io.to(ManagerRoom).emit('payment', result.orders)
    }
    reply.send({
      message: 'Callback ZaloPay',
      data: result
    })
  })

  fastify.post(
    '/order-status/:app_trans_id',
    {
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const app_trans_id = (request.params as { app_trans_id: string }).app_trans_id
      let postData: { appid: string; apptransid: string; mac?: string } = {
        appid: envConfig.ZP_APP_ID,
        apptransid: app_trans_id
      }

      let data = postData.appid + '|' + postData.apptransid + '|' + envConfig.ZP_KEY1
      postData.mac = CryptoJS.HmacSHA256(data, envConfig.ZP_KEY1).toString()

      let postConfig = {
        method: 'post',
        url: envConfig.ZP_CHECK_STATUS,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: QueryString.stringify(postData)
      }

      try {
        const result = await axios(postConfig)
        return reply.status(200).send(result.data)
      } catch (error) {
        if (error instanceof Error) {
          console.log(error.message)
        } else {
          console.log(String(error))
        }
      }
    }
  )
}
