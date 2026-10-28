# NEULEARN

NEULEARN là ứng dụng học tập trực tuyến giúp người học tìm môn học, mở bài giảng PDF, theo dõi lịch sử và thời gian học. Giảng viên có thể quản lý môn học và học liệu; quản trị viên có thêm chức năng quản lý tài khoản và phân quyền.

## Chức năng chính

- Đăng nhập bằng email/mật khẩu hoặc tài khoản Microsoft (Azure).
- Gửi email khôi phục và đặt lại mật khẩu.
- Tìm kiếm môn học, bài giảng và chương học.
- Xem bài giảng PDF và theo dõi tài liệu đã truy cập.
- Xem thống kê thời gian học và tài liệu đã mở theo ngày.
- Mở trang quản lý tài khoản từ avatar, đổi tên hiển thị và truy cập nhanh tài liệu/thống kê.
- Giảng viên: tạo môn học, nhập danh sách môn, tải lên một hoặc nhiều PDF, chỉnh sửa và xóa nội dung do mình quản lý.
- Quản trị viên: quản lý hồ sơ người dùng, vai trò, môn học và học liệu.

## Công nghệ và kiến trúc

- **Frontend:** React 19 và Next.js 16; giao diện được build thành static export trong thư mục `out/`.
- **Backend:** Flask phục vụ giao diện đã build và các API nghiệp vụ tại `/api/`.
- **Dữ liệu và xác thực:** Supabase Auth, Postgres và Storage. Các thao tác dữ liệu/học liệu được thực hiện qua Flask; Supabase Auth trên trình duyệt tiếp tục xử lý đăng nhập, phiên đăng nhập, OAuth và khôi phục mật khẩu.

## Yêu cầu

- Python 3.10 trở lên.
- Node.js và npm.
- Một Supabase project đã cấu hình Auth và Storage.

## Cài đặt

Mở PowerShell tại thư mục dự án:

```powershell
npm install
python -m pip install -r requirements.txt
Copy-Item .env.example .env.local
```

Mở `.env.local` và điền thông tin Supabase:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` là khóa bí mật chỉ được sử dụng ở Flask. Không đổi tên thành `NEXT_PUBLIC_*`, không đưa khóa này vào frontend và không commit giá trị thật.

## Cấu hình Supabase

1. Mở **Supabase Dashboard → SQL Editor**.
2. Áp dụng lần lượt toàn bộ file `.sql` trong `supabase/migrations`, theo thứ tự tên file/thời gian. Các migration tạo hồ sơ, dữ liệu học tập, bảng môn học/tài liệu, chính sách truy cập và hàm thống kê.
3. Nếu cần quản trị viên ban đầu, đăng nhập tài khoản đó ít nhất một lần để tạo hồ sơ, sau đó chạy SQL với email chính xác:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

Thay `admin@example.com` bằng email quản trị thực tế. Tài khoản có vai trò `admin` mới thấy các nút quản lý người dùng và học liệu.

## Chạy ứng dụng

### Chạy Flask với giao diện đã build

```powershell
npm run build
python app.py
```

Mở <http://127.0.0.1:5000>. Khi thay đổi giao diện, chạy lại `npm run build`. Khi thay đổi mã Flask, dừng server bằng `Ctrl+C` rồi chạy lại `python app.py`.

Lệnh `npm start` cũng khởi động Flask, nhưng cần build frontend trước.

### Chạy Next.js trong lúc phát triển giao diện

Mở hai terminal riêng:

```powershell
# Terminal 1: API Flask
python app.py
```

```powershell
# Terminal 2: frontend Next.js
npm run dev
```

Truy cập URL Next.js được in trong terminal (thường là <http://localhost:3000>). Với cổng `3000` hoặc `3001`, frontend gửi API tới Flask tại `http://127.0.0.1:5000`. Flask cho phép CORS mặc định từ các origin localhost này.

Nếu dùng cổng Next.js khác hoặc chạy Flask ở máy chủ/port khác:

- Đặt `NEXT_PUBLIC_FLASK_API_URL` bằng địa chỉ gốc của Flask, ví dụ `http://127.0.0.1:5000`.
- Đặt `FLASK_CORS_ORIGINS` thành danh sách origin frontend được phép, phân cách bằng dấu phẩy.
- Với `NEXT_PUBLIC_*`, đặt biến trước khi build/chạy frontend để Next.js đưa cấu hình vào client bundle.

## Kiểm tra

Kiểm tra Flask:

```powershell
python -m unittest discover -s tests -v
```

Kiểm tra TypeScript:

```powershell
npm exec -- tsc --noEmit
```

Build static frontend:

```powershell
npm run build
```

Endpoint `/healthz` trả trạng thái Flask và trường `built`, cho biết thư mục `out/` đã có giao diện build hay chưa.

## Cấu trúc thư mục

```text
app/                     Gốc ứng dụng Next.js và stylesheet
components/              Thành phần giao diện và các màn hình
lib/                     Client API Flask, Supabase Auth và kiểu dữ liệu dùng chung
supabase/migrations/     Migration schema và chính sách Supabase
tests/                   Kiểm thử API Flask
admin_api.py             API quản trị người dùng
learning_api.py          API hồ sơ, môn học, học liệu và hoạt động học tập
app.py                   Flask app, phục vụ frontend export và đăng ký API
out/                     Frontend static export được tạo bởi npm run build
```

## Xử lý sự cố

- **Không mở được ứng dụng / Flask báo thiếu frontend:** chạy `npm run build`, sau đó khởi động lại Flask.
- **Danh sách môn học hoặc hồ sơ không tải:** mở ứng dụng qua Flask hoặc kiểm tra `NEXT_PUBLIC_FLASK_API_URL`; kiểm tra URL và service-role key trong `.env.local`.
- **API hoạt động nhưng yêu cầu đăng nhập thất bại:** đăng nhập lại để lấy phiên Supabase hợp lệ.
- **Không thấy nút quản lý:** kiểm tra vai trò trong `public.profiles`. Admin cần `role = 'admin'`; giảng viên cần `role = 'lecturer'`.
- **Đổi mã Flask nhưng ứng dụng vẫn chạy hành vi cũ:** dừng đúng tiến trình Flask đang chạy bằng `Ctrl+C` rồi khởi động lại.

## Bảo mật

- Không commit `.env.local` hoặc các khóa bí mật.
- Không sử dụng service-role key trong trình duyệt.
- Các API Flask yêu cầu access token Supabase và kiểm tra quyền theo vai trò.
- Khi triển khai công khai, dùng HTTPS và cấu hình reverse proxy phù hợp; server phát triển Flask không nên dùng làm máy chủ production trực tiếp.
