# Check-in Cảm Xúc · Manabie AI Lab

Trò chơi tương tác thực tế ảo tăng cường (**Augmented Reality - AR**) sử dụng công nghệ nhận diện **cử chỉ bàn tay qua camera** (chụm tay để bốc, mở tay để thả), kết hợp âm thanh tương tác sinh động và bảng xếp hạng Dashboard trực quan.

Trò chơi được thiết kế theo tư duy **Mobile-First**, giao diện vừa vặn trên 1 màn hình (không cần cuộn/scroll), tối ưu hiển thị và trải nghiệm mượt mà trên cả máy tính, tablet lẫn màn hình trình chiếu lớp học.

---

## 🌟 Tính Năng & Cơ Chế Chơi

### 1. Tên Trò Chơi: **Check-in Cảm Xúc**
- Hoạt động mở đầu, khởi động tạo không khí hào hứng cho lớp học và buổi tập huấn AI của Manabie.

### 2. Cơ Chế 2 Vòng Chơi (30 Giây & 10 Cảm Xúc Mỗi Vòng)
Trò chơi được chia làm **2 vòng rõ rệt** giúp người chơi làm quen rồi tăng tốc phản xạ:
- **Vòng 1 (Khởi động - 30s)**:
  - **Nhịp điệu**: Icon rơi ít và chậm rãi, thư thả, giúp người chơi dễ dàng đưa bàn tay vào chụm ngón tay và kéo thả.
  - **Mục tiêu**: Phân loại đúng 10 cảm xúc để chuyển vòng.
- **Màn Chuyển Vòng (Đếm ngược 3s)**:
  - Khi hoàn thành Vòng 1, hệ thống chúc mừng `✓ HOÀN THÀNH VÒNG 1 (KHỞI ĐỘNG)` và đếm ngược 3..2..1 hào hứng chuẩn bị vào Vòng 2.
- **Vòng 2 (Tăng tốc & Thử thách 🔥 - 30s)**:
  - **Nhịp điệu**: Icon cảm xúc rơi nhiều hơn và nhanh hơn, xuất hiện đan xen liên tục.
  - **Mục tiêu**: Chinh phục tiếp 10 cảm xúc để giành chiến thắng toàn diện!

### 3. Quy Tắc Bốc Thả Bằng Cử Chỉ Bàn Tay AR
- **Chụm tay để bốc**: Chụm ngón cái và ngón trỏ để gắp icon cảm xúc. Mỗi lần chỉ được gắp đúng 1 icon duy nhất.
- **Mở tay để thả**: Kéo icon vào đúng giỏ cảm xúc tương ứng rồi mở tay ra để thả.
- **Thả trượt bên ngoài giỏ**: Nếu người chơi thả ra ngoài khoảng trống, icon sẽ tạm dừng lơ lửng 0.5s rồi tự động tiếp tục rơi xuống.
- **Tự rơi chạm đáy không tính điểm**: Cảm xúc tự rơi xuống đáy màn hình đi qua khu vực rổ (không do bàn tay người chơi bốc thả) sẽ trôi qua tự nhiên, không bị tính điểm hay trừ điểm.
- **Phạt khi thả sai giỏ hoặc gắp ảnh nhiễu**: Bốc sai giỏ hoặc bốc phải icon gây nhiễu sẽ **bị trừ 100 điểm**.

### 4. Hiển Thị Con Trỏ AR Tinh Gọn (Không Rườm Rà Khung Xương)
- Hiển thị theo chuẩn tối giản: Đoạn thẳng phát sáng nối 2 đầu ngón tay cùng tâm ngắm gắp tròn (nét đứt khi mở tay, nét liền xanh phát sáng khi chụm tay).
- Không hiển thị khung xương skeleton rườm rà, giúp tầm nhìn thoáng và tập trung.
- **Tự động tắt phần cứng Camera & giải phóng GPU ngay sau khi chơi xong** để máy tính luôn mát mẻ, không bị giật lag.

### 5. Ba Giỏ Cảm Xúc Chuẩn (Cắt từ `Feelling_racket.png`)
- **Giỏ BUỒN** (`basket_left.png`): Dành cho các icon như `cry.gif`, `loudly-crying.gif`, `sweat.gif`...
- **Giỏ VUI** (`basket_center.png`): Dành cho các icon như `grin.gif`, `grinning.gif`, `joy.gif`, `smile-with-big-eyes.gif`...
- **Giỏ GIẬN** (`basket_right.png`): Dành cho các icon như `angry.gif`, `rage.gif`, `triumph.gif`...

### 6. Chọn Nhân Vật & Đặt Tên Đội (Hiện Ngay Đầu Game)
- Ngay khi mở game, hộp thoại chọn nhân vật và điền thông tin nhóm, lớp sẽ hiện lên đầu tiên.
- Bố cục 36 nhân vật hoạt hình xếp gọn gàng trong lưới hiển thị trọn vẹn, không cần thanh cuộn (no scroll).
- Tự động ghi nhớ thông tin đội chơi vào `sessionStorage`.

### 7. Bảng Xếp Hạng Dashboard Trực Quan (Dạng Bảng, Max 20 Đội/Bảng)
- Xem bảng thành tích dạng bảng chuyên nghiệp với phân trang rõ ràng, mỗi bảng/trang hiển thị **tối đa 20 đội chơi**.
- Hỗ trợ tìm kiếm đội chơi, lọc theo lớp, và xem các chỉ số thống kê (Điểm cao nhất, Tỷ lệ chiến thắng, Điểm trung bình).

---

## 🚀 Khởi Chạy Dự Án

```powershell
npm run dev
```

Cổng truy cập:
- Máy tính: `http://localhost:3300/` (hoặc `http://localhost:3301/`)
- Điện thoại di động: Mở đường link IP hiển thị trên terminal (ví dụ: `http://192.168.x.x:3301/`).
