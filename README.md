# Giới thiệu về API

Đây là backend API cho dự án Order món ăn

- Authentication: Đăng nhập, đăng ký, đăng xuất
- Indicator: Thống kê doanh thu, khách hàng, đơn đặt hàng
- Account: CRUD thông tin cá nhân, tài khoản nhân viên
- Dish: CRUD món ăn
- Table: CRUD bàn ăn
- Order: CRUD đơn hàng
- Media: Upload hình ảnh
- Test API

> Trong file `server/.env` có thuộc tính `COOKIE_MODE`, hãy set `true` nếu muốn dùng cookie cho việc authentication ở server

## Công nghệ sử dụng

Fastify, Prisma, TypeScript, JWT, WebSockets (Socket.io)

## Cài đặt

Chỉ cần clone repository này về máy, cd vào thư mục, cài đặt các packages và chạy lệnh `npm run dev` là được

```bash
cd server
npm i
npm run dev
```

Trong trường hợp muốn chạy dishion, chạy lệnh

```bash
npm run build
npm run start
```

Muốn xem thông tin database, chỉ cần mở Prisma Studio lên bằng câu lệnh

```bash
npx prisma studio
```

Nó sẽ chạy ở url [http://localhost:5555](http://localhost:5555)

Khi upload thì hình ảnh sẽ được đi vào thư mục `/uploads` trong folder `server`

## Format response trả về

Định dạng trả về là JSON, và luôn có trường `message`, ngoài ra có thể sẽ có trường `data` hoặc `errors`

Đây là ví dụ về response trả về khi thành công

```json
{
  "data": {
    "id": 1,
    "name": "Bún đậu đặc biệt",
    "price": 291000,
    "description": "Mô tả cho bún đậu đặc biệt",
    "image": "http://localhost:4000/static/bec024f9ea534b7fbf078cb5462b30aa.jpg",
    "status": "Available",
    "createdAt": "2024-03-11T03:51:14.028Z",
    "updatedAt": "2024-03-11T03:51:14.028Z"
  },
  "message": "Thêm món ăn thành công!"
}
```

Trong trường hợp lỗi thì nếu lỗi liên quan đến việc body gửi lên không đúng định dạng thì server sẽ trả về lỗi `422` và thông tin lỗi như sau

Ví dụ dưới đây body thiếu trường `price`

```json
{
  "message": "A validation error occurred when validating the body...",
  "errors": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "undefined",
      "path": ["price"],
      "message": "Required",
      "field": "price"
    }
  ],
  "code": "FST_ERR_VALIDATION",
  "statusCode": 422
}
```

Trong trường hợp lỗi khác, server sẽ trả về lỗi trong trường `message`, ví dụ

```json
{
  "message": "Không tìm thấy dữ liệu!",
  "statusCode": 404
}
```

## Chi tiết các API

Mặc định API sẽ chạy ở địa chỉ [http://localhost:4000](http://localhost:4000), muốn đổi port thì vào file `.env` để thay đổi port

Với các API POST, PUT thông thường thì body gửi lên phải là JSON, và phải có header `Content-Type: application/json`.

Đặc biệt API upload hình ảnh thì phải gửi dưới dạng `form-data`

API xác thực người dùng thông qua session token, session token này là một JWT, secret key JWT này sẽ được lưu trong file `.env` và được sử dụng để tạo và verify token

Đối với các API cần xác thực người dùng như bên cụm API về `Account` thì cần gửi accessToken lên server thông qua header `Authorization: "Bearer <accessToken>"`

### Test API: muốn biết API có hoạt động không

- `GET /test`: Trả về message nghĩa là API hoạt động

## Tài khoản

Admin

- Email: `admin@dau.stu.id.vn`
- Mật khẩu: `123456`

Nhân viên

- Email: `nhanvien@stu.id.vn`
- Mật khẩu: `123456`
