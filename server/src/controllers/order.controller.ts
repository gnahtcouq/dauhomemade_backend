import envConfig from '@/config'
import { DishStatus, OrderStatus, TableStatus } from '@/constants/type'
import prisma from '@/database'
import { CreateOrdersBodyType, PayGuestOrdersResType, UpdateOrderBodyType } from '@/schemaValidations/order.schema'
import moment from 'moment'
import CryptoJS from 'crypto-js'
import axios from 'axios'

export const createOrdersController = async (orderHandlerId: number, body: CreateOrdersBodyType) => {
  const { guestId, orders } = body
  const guest = await prisma.guest.findUniqueOrThrow({
    where: {
      id: guestId
    }
  })
  if (guest.tableNumber === null) {
    throw new Error('Bàn gắn liền với khách hàng này đã bị xóa, vui lòng chọn khách hàng khác!')
  }
  const table = await prisma.table.findUniqueOrThrow({
    where: {
      number: guest.tableNumber
    }
  })
  if (table.status === TableStatus.Hidden) {
    throw new Error(`Bàn ${table.number} gắn liền với khách hàng đã bị ẩn, vui lòng chọn khách hàng khác!`)
  }

  const [ordersRecord, socketRecord] = await Promise.all([
    prisma.$transaction(async (tx) => {
      const ordersRecord = await Promise.all(
        orders.map(async (order) => {
          const dish = await tx.dish.findUniqueOrThrow({
            where: {
              id: order.dishId
            }
          })
          if (dish.status === DishStatus.Unavailable) {
            throw new Error(`Món ${dish.name} đã hết`)
          }
          if (dish.status === DishStatus.Hidden) {
            throw new Error(`Món ${dish.name} không thể đặt`)
          }
          const dishSnapshot = await tx.dishSnapshot.create({
            data: {
              description: dish.description,
              image: dish.image,
              name: dish.name,
              price: dish.price,
              dishId: dish.id,
              status: dish.status
            }
          })
          const orderRecord = await tx.order.create({
            data: {
              dishSnapshotId: dishSnapshot.id,
              guestId,
              quantity: order.quantity,
              tableNumber: guest.tableNumber,
              orderHandlerId,
              status: OrderStatus.Pending
            },
            include: {
              dishSnapshot: true,
              guest: true,
              orderHandler: true
            }
          })
          type OrderRecord = typeof orderRecord
          return orderRecord as OrderRecord & {
            status: (typeof OrderStatus)[keyof typeof OrderStatus]
            dishSnapshot: OrderRecord['dishSnapshot'] & {
              status: (typeof DishStatus)[keyof typeof DishStatus]
            }
          }
        })
      )
      return ordersRecord
    }),
    prisma.socket.findUnique({
      where: {
        guestId: body.guestId
      }
    })
  ])
  return {
    orders: ordersRecord,
    socketId: socketRecord?.socketId
  }
}

export const getOrdersController = async ({ fromDate, toDate }: { fromDate?: Date; toDate?: Date }) => {
  const orders = await prisma.order.findMany({
    include: {
      dishSnapshot: true,
      orderHandler: true,
      guest: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    where: {
      createdAt: {
        gte: fromDate,
        lte: toDate
      }
    }
  })
  return orders
}

// Controller thanh toán các hóa đơn dựa trên guestId
export const payOrdersController = async ({ guestId, orderHandlerId }: { guestId: number; orderHandlerId: number }) => {
  const orders = await prisma.order.findMany({
    where: {
      guestId,
      status: {
        in: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Delivered]
      }
    }
  })
  if (orders.length === 0) {
    throw new Error('Không có hóa đơn nào cần thanh toán')
  }
  await prisma.$transaction(async (tx) => {
    const orderIds = orders.map((order) => order.id)
    const updatedOrders = await tx.order.updateMany({
      where: {
        id: {
          in: orderIds
        }
      },
      data: {
        status: OrderStatus.Paid,
        orderHandlerId
      }
    })
    return updatedOrders
  })
  const [ordersResult, sockerRecord] = await Promise.all([
    prisma.order.findMany({
      where: {
        id: {
          in: orders.map((order) => order.id)
        }
      },
      include: {
        dishSnapshot: true,
        orderHandler: true,
        guest: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.socket.findUnique({
      where: {
        guestId
      }
    })
  ])
  return {
    orders: ordersResult,
    socketId: sockerRecord?.socketId
  }
}

// Controller thanh toán các hóa đơn dựa trên guestId với ZaloPay
export const payOrdersWithZaloPayController = async ({ guestId }: { guestId: number }) => {
  const orders = await prisma.order.findMany({
    where: {
      guestId,
      status: {
        in: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Delivered]
      }
    },
    include: {
      dishSnapshot: true
    }
  })

  if (orders.length === 0) {
    throw new Error('Không có hóa đơn nào cần thanh toán')
  }
  // Tính tổng số tiền cần thanh toán dựa trên dishSnapshot
  const totalAmount = orders.reduce((sum, order) => {
    return sum + order.dishSnapshot.price * order.quantity
  }, 0)

  const embed_data = {
    redirecturl: envConfig.ZP_REDIRECT_URL
  }
  const items = orders.map((order) => ({
    guestId: order.guestId, // ID của khách hàng
    item_name: order.dishSnapshot.name, // Tên món ăn
    item_price: order.dishSnapshot.price, // Giá món ăn
    item_quantity: order.quantity // Số lượng món ăn
  }))
  const transID = Math.floor(Math.random() * 1000000)
  // Thông tin đơn hàng gửi lên ZaloPay
  const orderData: {
    app_id: string
    app_trans_id: string
    app_user: string
    app_time: number
    item: string
    embed_data: string
    amount: number
    description: string
    bank_code: string
    callback_url: string
    mac?: string
  } = {
    app_id: envConfig.ZP_APP_ID,
    app_trans_id: `${moment().format('YYMMDD')}_${transID}`, // Mã giao dịch với định dạng YYMMDD_transID
    app_user: guestId.toString(), // Thông tin người dùng
    app_time: Date.now(), // Thời gian tạo đơn hàng (miliseconds)
    item: JSON.stringify(items), // Danh sách sản phẩm trong đơn hàng
    embed_data: JSON.stringify(embed_data), // Dữ liệu bổ sung
    amount: totalAmount, // Tổng số tiền cần thanh toán
    description: `Thanh toán cho ${orders.length} đơn hàng tại Đậu Homemade`, // Mô tả giao dịch
    bank_code: '', // Mã ngân hàng (để trống nếu không yêu cầu)
    callback_url: envConfig.ZP_CALLBACK_URL // URL callback để nhận kết quả thanh toán
  }
  // Tạo chữ ký (mac) để xác thực yêu cầu với ZaloPay
  const data =
    envConfig.ZP_APP_ID +
    '|' +
    orderData.app_trans_id +
    '|' +
    orderData.app_user +
    '|' +
    orderData.amount +
    '|' +
    orderData.app_time +
    '|' +
    orderData.embed_data +
    '|' +
    orderData.item

  orderData.mac = CryptoJS.HmacSHA256(data, envConfig.ZP_KEY1).toString() // Ký bằng key1 từ config
  try {
    // Gửi yêu cầu thanh toán lên ZaloPay
    const result = await axios.post(envConfig.ZP_CREATE_ORDER, null, { params: orderData })
    // Cập nhật app_trans_id vào order
    await prisma.order.updateMany({
      where: {
        id: { in: orders.map((order) => order.id) }
      },
      data: {
        app_trans_id: orderData.app_trans_id
      }
    })
    return {
      paymentUrl: result.data.order_url, // URL thanh toán từ ZaloPay
      orders
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error('Không thể tạo yêu cầu thanh toán với ZaloPay')
    } else {
      throw new Error('Có lỗi xảy ra khi thanh toán')
    }
  }
}

export const callbackZaloPayController = async (body: { data: string; mac: string }) => {
  let result: { returncode?: number; returnmessage?: string; socketId?: string; orders?: any[] } = {}
  try {
    const { data: dataStr, mac: reqMac } = body
    // Tạo mã MAC để xác thực với ZaloPay
    const mac = CryptoJS.HmacSHA256(dataStr, envConfig.ZP_KEY2).toString()
    // Kiểm tra tính hợp lệ của callback (từ ZaloPay server)
    if (reqMac !== mac) {
      // callback không hợp lệ
      result.returncode = -1
      result.returnmessage = 'mac not equal'
    } else {
      result.returncode = 1
      result.returnmessage = 'success'
      const dataJson = JSON.parse(dataStr)
      const appTransId = dataJson['app_trans_id'] // Lấy app_trans_id từ dữ liệu trả về
      const socketRecord = await prisma.socket.findUnique({
        where: {
          guestId: JSON.parse(dataJson.item)[0].guestId
        }
      })
      const orders = await prisma.order.findMany({
        where: {
          app_trans_id: appTransId
        },
        include: {
          dishSnapshot: true,
          orderHandler: true,
          guest: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      result.orders = orders
      result.socketId = socketRecord?.socketId

      await prisma.order.updateMany({
        where: {
          app_trans_id: appTransId
        },
        data: {
          status: OrderStatus.Paid
        }
      })
    }
  } catch (ex) {
    result.returncode = 0 // ZaloPay server sẽ callback lại (tối đa 3 lần)
    result.returnmessage = (ex as Error).message
  }
  return result
}

export const getOrderDetailController = (orderId: number) => {
  return prisma.order.findUniqueOrThrow({
    where: {
      id: orderId
    },
    include: {
      dishSnapshot: true,
      orderHandler: true,
      guest: true,
      table: true
    }
  })
}

export const updateOrderController = async (
  orderId: number,
  body: UpdateOrderBodyType & { orderHandlerId: number }
) => {
  const { status, dishId, quantity, orderHandlerId } = body
  const result = await prisma.$transaction(async (tx) => {
    const order = await prisma.order.findUniqueOrThrow({
      where: {
        id: orderId
      },
      include: {
        dishSnapshot: true
      }
    })
    let dishSnapshotId = order.dishSnapshotId
    if (order.dishSnapshot.dishId !== dishId) {
      const dish = await tx.dish.findUniqueOrThrow({
        where: {
          id: dishId
        }
      })
      const dishSnapshot = await tx.dishSnapshot.create({
        data: {
          description: dish.description,
          image: dish.image,
          name: dish.name,
          price: dish.price,
          dishId: dish.id,
          status: dish.status
        }
      })
      dishSnapshotId = dishSnapshot.id
    }
    const newOrder = await tx.order.update({
      where: {
        id: orderId
      },
      data: {
        status,
        dishSnapshotId,
        quantity,
        orderHandlerId
      },
      include: {
        dishSnapshot: true,
        orderHandler: true,
        guest: true
      }
    })
    return newOrder
  })
  const socketRecord = await prisma.socket.findUnique({
    where: {
      guestId: result.guestId!
    }
  })
  return {
    order: result,
    socketId: socketRecord?.socketId
  }
}
