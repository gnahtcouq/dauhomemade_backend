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
import moment from 'moment'
import { v4 as uuid } from 'uuid'
import CryptoJS from 'crypto-js'
import axios from 'axios'

const config = {
  appid: '554',
  key1: '8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn',
  key2: 'uUfsWgfLkRLzq6W2uNXTCxrfxs51auny',
  endpoint: 'https://sandbox.zalopay.com.vn/v001/tpe/createorder'
}
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
        message: 'Lấy danh sách đơn hàng thành công!',
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
      preValidation: fastify.auth([requireOwnerHook, requireEmployeeHook], {
        relation: 'or'
      })
    },
    async (request, reply) => {
      const userRole = request.decodedAccessToken?.role

      const currentOrder = await getOrderDetailController(request.params.orderId)

      // Kiểm tra trạng thái thanh toán
      if (currentOrder.status === 'Paid') {
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
      preValidation: fastify.auth([requireOwnerHook])
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

  fastify.post('/zalopay', async (request, reply) => {
    const embeddata = {
      redirecturl: 'https://github.com/gnahtcouq'
    }
    const items = [{}]

    const order: {
      appid: string
      apptransid: string
      appuser: string
      apptime: number
      item: string
      embeddata: string
      amount: number
      description: string
      bankcode: string
      mac?: string
      callback_url: string
    } = {
      appid: config.appid,
      apptransid: `${moment().format('YYMMDD')}_${uuid()}`, // mã giao dich có định dạng yyMMdd_xxxx
      appuser: 'demo',
      apptime: Date.now(), // miliseconds
      item: JSON.stringify(items),
      embeddata: JSON.stringify(embeddata),
      amount: 50000,
      description: 'Thanh toán đơn hàng tại Đậu Homemade',
      bankcode: '',
      callback_url: 'https://dau.stu.id.vn:81/api/callback'
    }

    const data =
      config.appid +
      '|' +
      order.apptransid +
      '|' +
      order.appuser +
      '|' +
      order.amount +
      '|' +
      order.apptime +
      '|' +
      order.embeddata +
      '|' +
      order.item

    order.mac = CryptoJS.HmacSHA256(data, config.key1).toString()
    try {
      const result = await axios.post(config.endpoint, null, { params: order })
      return reply.status(200).send(result.data)
    } catch (error) {
      if (error instanceof Error) {
        console.log(error.message)
      } else {
        console.log(String(error))
      }
    }
  })

  fastify.post('/callback', async (request, reply) => {
    let result: { returncode?: number; returnmessage?: string } = {}

    try {
      let dataStr = (request.body as { data: string }).data
      let reqMac = (request.body as { mac: string }).mac

      let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString()
      console.log('mac =', mac)

      // kiểm tra callback hợp lệ (đến từ ZaloPay server)
      if (reqMac !== mac) {
        // callback không hợp lệ
        result.returncode = -1
        result.returnmessage = 'mac not equal'
      } else {
        // thanh toán thành công
        // merchant cập nhật trạng thái cho đơn hàng
        result.returncode = 1
        result.returnmessage = 'success'
      }
    } catch (ex) {
      result.returncode = 0 // ZaloPay server sẽ callback lại (tối đa 3 lần)
      result.returnmessage = (ex as Error).message
    }

    // thông báo kết quả cho ZaloPay server
    reply.send(result)
  })
}
