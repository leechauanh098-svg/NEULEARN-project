# Chạy NEULEARN bằng Flask

## Cài đặt và chạy

Yêu cầu Node.js/npm và Python 3.10 trở lên.

```powershell
npm install
python -m pip install -r requirements.txt
npm run build
python app.py
```

Mở `http://127.0.0.1:5000`. `npm run build` tạo thư mục `out`; hãy build lại sau khi sửa giao diện. `npm run dev` vẫn chạy Next.js ở chế độ phát triển.

Các API nghiệp vụ và quản trị người dùng chạy trên Flask. Mở giao diện qua `http://127.0.0.1:5000` để dùng cùng origin. Khi chạy giao diện bằng `npm run dev` ở cổng 3000 hoặc 3001, frontend tự gửi API sang Flask ở cổng 5000; Flask cho phép CORS chỉ từ hai cổng localhost này. Nếu Flask chạy ở địa chỉ khác, đặt `NEXT_PUBLIC_FLASK_API_URL` trước khi chạy/build frontend và thêm origin giao diện vào `FLASK_CORS_ORIGINS` (danh sách origin phân cách bằng dấu phẩy).

Sau khi cập nhật mã Flask, cần dừng tiến trình Flask đang chạy bằng `Ctrl+C` rồi chạy lại `python app.py`; tiến trình cũ không tự nạp lại các API mới nếu `FLASK_DEBUG` chưa bật.

Giao diện React/Next.js được export tĩnh và Flask phục vụ nguyên giao diện đó; không cần viết lại HTML/CSS. Các API Flask xử lý hồ sơ (xem/cập nhật tên hiển thị), môn học, tài liệu PDF, lịch sử/thống kê học tập và quản trị người dùng. Supabase vẫn là dịch vụ xác thực và lưu trữ dữ liệu/file phía sau Flask. Đăng nhập OAuth, gửi email khôi phục và cập nhật mật khẩu tiếp tục dùng Supabase Auth; không gửi thông tin mật khẩu người dùng qua API nghiệp vụ Flask.

Next.js đọc `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` từ `.env.local` lúc build. Flask xác minh access token và dùng publishable/anon key cùng token của người đăng nhập để đọc hồ sơ, môn học, tài liệu, thống kê, tạo signed URL có thời hạn cho PDF riêng tư, và thực hiện các thao tác môn học/học liệu được RLS cho phép. Vì vậy người học, giảng viên và admin có thể tự chạy bản clone chỉ với URL project và publishable key; dữ liệu vẫn được giới hạn theo access token, vai trò và chính sách RLS/Storage.

Các API quản lý tài khoản qua Supabase Auth Admin cần `SUPABASE_SERVICE_ROLE_KEY` trên Flask; không gửi khóa này cho người tải code. Đây là khóa bí mật có quyền cao: chỉ cấu hình trên máy chủ tin cậy, không đưa vào biến `NEXT_PUBLIC_*` và không commit giá trị thật. Tài khoản admin trong cùng Supabase project có thể quản lý môn học và học liệu qua các chính sách RLS; API quản lý tài khoản chỉ hoạt động trên máy chủ tin cậy có service-role key và chỉ cho hồ sơ có vai trò `admin`.

Vai trò ban đầu được đặt trong `public.profiles`. Để tạo quản trị viên đầu tiên, chạy câu lệnh sau trong Supabase SQL Editor và thay email bằng tài khoản cần cấp quyền:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

Hãy áp dụng các migration trong `supabase/migrations`, bao gồm migration `20261028020000_admin_storage_transfer.sql`, trước khi bật chức năng xóa tài khoản. Sau khi thiết lập, quản trị viên có thể tạo tài khoản, cập nhật hồ sơ/email/vai trò và xóa tài khoản. Khi xóa tài khoản, môn học, tài liệu và quyền sở hữu file PDF do tài khoản đó tạo sẽ được chuyển cho quản trị viên đang thao tác; lịch sử học tập gắn với tài khoản sẽ bị xóa theo quan hệ cascade. Không thể tự xóa tài khoản đang đăng nhập hoặc hạ quyền quản trị viên cuối cùng.

Các API ở đường dẫn `/api/` được Flask phục vụ. Với các cổng Next.js tùy chỉnh ngoài 3000/3001, phải cấu hình `NEXT_PUBLIC_FLASK_API_URL`; nếu không, trình duyệt sẽ gửi nhầm API tới máy chủ giao diện.

Có thể đổi host/port bằng biến môi trường `FLASK_HOST` và `FLASK_PORT`. Endpoint `/healthz` kiểm tra server và báo `built: false` nếu chưa có frontend export.

Khi deploy qua HTTPS, reverse proxy nên chuyển tiếp kết nối HTTPS cho Flask để bật header HSTS.
