import { getOrdersController } from '@/controllers/order.controller'
import prisma from '@/database'
import { DashboardIndicatorResType } from '@/schemaValidations/indicator.schema'

// Tính doanh thu theo từng ngày
const calculateRevenueByDate = (orders: any[]) => {
  const revenueByDateMap: Record<string, number> = {}

  orders.forEach((order) => {
    const date = order.createdAt.toISOString().split('T')[0]
    if (!revenueByDateMap[date]) {
      revenueByDateMap[date] = 0
    }
    // Tính doanh thu từ giá và số lượng
    const revenue = order.dishSnapshot.price * order.quantity
    revenueByDateMap[date] += revenue
  })

  return Object.entries(revenueByDateMap).map(([date, revenue]) => ({
    date,
    revenue
  }))
}

// Lấy thông tin các món ăn
const getDishIndicator = async () => {
  const dishes = await prisma.dish.findMany()
  return dishes.map((dish) => ({
    ...dish,
    status: dish.status as 'Available' | 'Unavailable' | 'Hidden',
    successOrders: 0
  }))
}

// Cập nhật số đơn hàng thành công của từng món ăn
const updateDishSuccessOrders = (orders: any[], dishes: any[]) => {
  orders.forEach((order) => {
    const dish = dishes.find((d) => d.id === order.dishSnapshot.dishId)
    if (dish) {
      // Tính số lượng đơn hàng thành công
      dish.successOrders = (dish.successOrders || 0) + order.quantity
    }
  })
}

export const dashboardIndicatorController = async ({
  fromDate,
  toDate
}: {
  fromDate?: Date
  toDate?: Date
}): Promise<DashboardIndicatorResType['data']> => {
  const orders = await getOrdersController({ fromDate, toDate })

  // Tính toán các chỉ số
  // Tổng doanh thu
  const revenue = orders.reduce((acc, order) => {
    if (order.status === 'Paid') {
      // Chỉ tính doanh thu từ những đơn hàng đã thanh toán
      return acc + order.dishSnapshot.price * order.quantity
    }
    return acc
  }, 0)

  // Số lượng khách duy nhất
  const guestCount = new Set(orders.map((order) => order.guestId)).size
  // Số lượng đơn hàng
  const orderCount = orders.length
  const orderPaidCount = orders.reduce((acc, order) => {
    if (order.status === 'Paid') {
      // Chỉ tính số lượng đơn hàng từ những đơn hàng đã thanh toán
      return acc + 1
    }
    return acc
  }, 0)
  // Số lượng bàn phục vụ
  const servingTableCount = new Set(
    orders
      .filter((order) => order.tableNumber) // Lọc những đơn hàng có số bàn
      .map((order) => order.tableNumber) // Lấy số bàn
  ).size // Đếm số lượng bàn duy nhất

  const dishes = await getDishIndicator()
  updateDishSuccessOrders(orders, dishes)

  const revenueByDate = calculateRevenueByDate(orders)

  return {
    revenue,
    guestCount,
    orderCount,
    orderPaidCount,
    servingTableCount,
    dishIndicator: dishes,
    revenueByDate
  }
}
