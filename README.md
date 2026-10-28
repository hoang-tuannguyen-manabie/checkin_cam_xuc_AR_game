# Check-in Cảm Xúc · Manabie AI Lab

Trò chơi tương tác thực tế ảo tăng cường (**Augmented Reality - AR**) sử dụng công nghệ nhận diện **Hand Skeleton (khung xương khớp bàn tay 21 điểm)** qua camera, kết hợp WebAudio tương tác và đồng bộ điểm số lên cơ sở dữ liệu **Supabase**.

Trò chơi được thiết kế theo tư duy **Mobile-First**, tối ưu hiển thị và trải nghiệm chạm vuốt trên cả thiết bị di động, tablet lẫn màn hình trình chiếu lớp học.

---

## 🌟 Tính Năng & Cơ Chế Chơi

### 1. Tên Trò Chơi: **Check-in Cảm Xúc**
- Hoạt động mở đầu, khởi động tạo không khí hào hứng cho lớp học và buổi tập huấn AI của Manabie.

### 2. Cơ Chế 2 Vòng Chơi (Vòng 1 Chậm ➔ Vòng 2 Nhanh Hơn & Rơi Nhiều Hơn)
Trò chơi được chia làm **2 vòng rõ rệt** giúp người chơi làm quen rồi tăng tốc phản xạ:
- **Vòng 1 (Khởi động)**:
  - **Nhịp điệu**: Icon rơi ít (tối đa 3-4 icon trên màn hình, mỗi ~2 giây mới xuất hiện 1 icon).
  - **Tốc độ**: Rơi chậm rãi (vận tốc ~0.038), thư thả, giúp người chơi dễ dàng đưa khớp bàn tay AR vào chụm ngón tay và kéo thả.
  - **Mục tiêu**: Phân loại đúng 7 cảm xúc (hoặc hết thời gian 25s) để chuyển vòng.
- **Màn Chuyển Vòng (Intermission 3s)**:
  - Khi hoàn thành Vòng 1, hệ thống chúc mừng `✓ HOÀN THÀNH VÒNG 1 (KHỞI ĐỘNG)` và đếm ngược 3..2..1 hào hứng chuẩn bị vào Vòng 2!
- **Vòng 2 (Tăng tốc & Thử thách 🔥)**:
  - **Nhịp điệu**: Icon rơi nhiều hơn gấp đôi (tối đa 6-8 icon trên màn hình, xuất hiện liên tục mỗi ~0.9s).
  - **Tốc độ**: Rơi nhanh hơn gấp đôi (~0.088 - 0.110), ảnh nhiễu xuất hiện đan xen để thử thách sự tập trung.
  - **Mục tiêu**: Chinh phục đủ 15 cảm xúc để giành chiến thắng tuyệt đối!

### 3. Sử Dụng Chính Icon GIF Nguyên Bản (Không Tinh Chỉnh Thêm)
- Đúng theo yêu cầu: Render trực tiếp ảnh GIF icon cảm xúc nguyên bản (kích thước chuẩn 72px – 88px co giãn responsive), **không bọc quả cầu thủy tinh nhân tạo, không viền phát sáng ảo, không đính kèm thẻ nhãn văn bản**.
- Cảm xúc hiển thị rõ ràng, chân thực, nguyên bản.

### 3. Hai GIF Ảnh Nhiễu (`hot-face.gif`, `dizzy-face.gif`)
- **Đặc điểm**: Hai icon cảm xúc `hot-face` (mặt bốc hỏa/nóng bừng) và `dizzy-face` (mặt hoa mắt chóng mặt) là **ảnh gây nhiễu**, **KHÔNG phù hợp với bất kỳ giỏ nào (Buồn, Vui hay Giận)**.
- **Cơ chế**:
  - Nếu người chơi cố tình hoặc vô ý kéo thả vào bất kỳ rổ nào: Hệ thống sẽ **báo lỗi ngay lập tức** ("ẢNH NHIỄU! Không hợp rổ nào!"), phát tiếng còi từ chối, rung màn hình cảnh báo, trừ chuỗi combo và icon sẽ dội ngược bay đi.
  - Người chơi cần **nhận biết và để ảnh nhiễu tự do rơi qua** màn hình mà không bị trừ điểm.

### 4. Ba Giỏ Cảm Xúc Chuẩn (Cắt từ `Feelling_racket.png`)
- **Giỏ BUỒN** (`basket_left.png`): Dành cho các icon như `cry.gif`, `loudly-crying.gif`, `sweat.gif`...
- **Giỏ VUI** (`basket_center.png`): Dành cho các icon như `grin.gif`, `grinning.gif`, `joy.gif`, `smile-with-big-eyes.gif`...
- **Giỏ GIẬN** (`basket_right.png`): Dành cho các icon như `angry.gif`, `rage.gif`, `triumph.gif`...

### 5. Thiết Kế Typescale Ưu Tiên Mobile-First
- **Typography & Layout co giãn linh hoạt**: Tự động điều chỉnh kích cỡ chữ, kích thước giỏ vợt, kích thước quả cầu theo tỷ lệ màn hình dọc (portrait) và ngang (landscape).
- **HUD thông minh 2 hàng**:
  - Hàng 1: Avatar đội chơi, Đồng hồ đếm ngược 30s nổi bật, Điểm số, Combo và Tín hiệu tay.
  - Hàng 2: Thanh tiến độ trực quan đạt tới mốc 15 cảm xúc và bộ đếm chi tiết 3 giỏ.
- **Nút bấm chuẩn Touch Target**: Tối thiểu 44px–48px dễ bấm, cỡ chữ input >= 16px ngăn chặn tự động phóng to trên iOS Safari.

### 6. Chọn Nhân Vật & Điền Nhóm, Lớp Trước Khi Chơi
- Modal tiện lợi điền thông tin nhóm, lớp, tên người chơi đại diện trước khi bắt đầu.
- Chọn avatar đại diện từ thư viện **36 nhân vật hoạt hình**.
- Tự động ghi nhớ phiên chơi vào `sessionStorage`.

### 7. Điều Kiện Kết Thúc & Chiến Thắng
- Mỗi lượt chơi kéo dài **30 giây** HOẶC **phân loại đúng 15 cảm xúc** vào đúng giỏ -> Kích hoạt màn hình chiến thắng với pháo hoa giấy Confetti rực rỡ và bảng tổng kết thành tích.

---

## 🗄️ Tích Hợp Cơ Sở Dữ Liệu Supabase

Dự án đã tích hợp sẵn dịch vụ lưu trữ Supabase qua chuẩn REST API (Zero-dependency, siêu nhẹ, hoạt động 100% không phụ thuộc thư viện nặng).

### 1. Cấu hình biến môi trường `.env`
Trong thư mục gốc `game-ar-phan-loai-cam-xuc-demo-manabie/`, chỉnh sửa file `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 2. Tạo bảng trong Supabase SQL Editor
Mở Supabase Dashboard -> chọn SQL Editor và chạy đoạn mã trong file `supabase_schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS checkin_cam_xuc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  player_name TEXT NOT NULL,
  character_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  target_count INTEGER NOT NULL DEFAULT 15,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  sad_count INTEGER NOT NULL DEFAULT 0,
  happy_count INTEGER NOT NULL DEFAULT 0,
  angry_count INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER NOT NULL DEFAULT 30,
  is_win BOOLEAN NOT NULL DEFAULT false,
  mode TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE checkin_cam_xuc_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read checkin records"
  ON checkin_cam_xuc_records FOR SELECT USING (true);

CREATE POLICY "Allow public insert checkin records"
  ON checkin_cam_xuc_records FOR INSERT WITH CHECK (true);
```

### 3. Tự động lưu sau mỗi lượt chơi
Khi kết thúc lượt chơi 30s hoặc hoàn thành 15 cảm xúc:
- Hệ thống tự động gửi bản ghi chứa thông tin: Tên nhóm, Lớp, Tên đại diện, Điểm số, Số cảm xúc đúng/sai, Chuỗi cao nhất, Thời gian hoàn thành.
- Màn hình tổng kết hiển thị huy hiệu xác nhận: `⚡ Đã lưu kết quả lên Supabase thành công!`.

---

## 🚀 Khởi Chạy Dự Án

```powershell
cd C:\Users\Manabie\OneDrive\Documents\manabie\coding\game-ar-phan-loai-cam-xuc-demo-manabie
npm run dev
```

Cổng truy cập:
- Máy tính: `http://localhost:3300/` (hoặc `http://localhost:3301/`)
- Điện thoại di động: Mở đường link IP nội bộ hiển thị trên terminal (ví dụ: `http://192.168.x.x:3301/`).
