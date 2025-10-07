# WebSocket + Spring Boot: Chat hỗ trợ khách hàng

Tài liệu tóm tắt cơ chế WebSocket/STOMP và hướng dẫn chạy thử chức năng chat.

## 1) WebSocket hoạt động thế nào?

- WebSocket mở một kết nối hai chiều giữa client và server qua TCP. Không giống HTTP request/response một chiều, cả hai bên có thể chủ động gửi dữ liệu bất cứ lúc nào.
- STOMP (Simple Text Oriented Messaging Protocol) là giao thức messaging chạy trên WebSocket, chuẩn hóa các destination như `/app/*`, `/topic/*`, `/queue/*` giúp định tuyến message dễ dàng.
- Trong Spring:
  - Client gửi message đến server theo prefix `/app` (ví dụ `/app/chat.sendMessage`).
  - Server broadcast đến người nghe qua broker với prefix `/topic` (nhiều người) hoặc `/user/queue` (riêng tư).

## 2) Cấu trúc chính trong dự án

- `WebSocketConfig`: Bật STOMP, đăng ký endpoint `/ws`, cấu hình broker `/topic`, `/queue`, prefix ứng dụng `/app` và user prefix `/user`.
- `ChatController`:
  - `@MessageMapping("/chat.sendMessage")` + `@SendTo("/topic/public")`: nhận message và broadcast public.
  - `@MessageMapping("/chat.addUser")` + `@SendTo("/topic/public")`: xử lý user join.
  - `@MessageMapping("/chat.sendPrivateMessage")` + `convertAndSendToUser(...)`: gửi tin riêng tới `/user/{name}/queue/private`.
- `WebSocketEventListener`: log sự kiện connect/disconnect, gửi thông báo rời phòng.
- Frontend:
  - `templates/chat.html`: giao diện chat (Thymeleaf view).
  - `static/js/chat.js`: client STOMP với tự động reconnect, heartbeat, chống XSS cơ bản.
  - `static/css/chat.css`: UI responsive, avatar, private message style.

## 3) Cách chạy

Yêu cầu: JDK 21+ và Maven wrapper có sẵn.

Chạy ứng dụng:

```bash
# Từ thư mục dự án
chmod +x mvnw
./mvnw spring-boot:run
```

Windows PowerShell/CMD:

```powershell
mvnw.cmd spring-boot:run
```

Mở trình duyệt tới: http://localhost:8080

Mở 2 tab hoặc 2 trình duyệt, nhập 2 tên khác nhau để test real-time chat.

## 4) Thử nhanh các tính năng

- Join/Leave: khi người dùng vào/ra, có thông báo JOIN/LEAVE trên public chat.
- Public chat: gửi tin tới `/topic/public` hiển thị cho tất cả tab đang mở.
- Private chat (API có sẵn ở server): gửi tới `/user/{receiver}/queue/private` (cần UI mở rộng để chọn người nhận nếu muốn).
- Auto-reconnect: nếu mất kết nối, client sẽ tự reconnect với exponential backoff.
- Heartbeat: client gửi nhịp để giữ kết nối sống (một số proxy/timeouts).
- Chống XSS cơ bản: escape tên và nội dung khi hiển thị.

## 5) Troubleshooting

- Lỗi datasource: vì dự án ban đầu có JPA, đã tắt auto-config DB trong `SpringBoot0710Application`.
- Không tải được JS/CSS: kiểm tra đường dẫn `/js/chat.js`, `/css/chat.css` và log browser.
- WebSocket blocked do CORS: trong dev, `WebSocketConfig` đang mở `setAllowedOriginPatterns("*")`.
- Lỗi 404 `/ws`: đảm bảo endpoint `/ws` đang được đăng ký và app chạy ở port 8080.

## 6) Nâng cấp gợi ý (tùy chọn)

- Thêm danh sách người online + chọn người để chat riêng.
- Lưu lịch sử chat bằng DB (khi đó bật JPA và cấu hình datasource).
- Authentication (Spring Security) để map user -> session.
- Phân luồng customer vs. support (routing theo room queue).

Chúc bạn học tốt WebSocket và xây dựng trải nghiệm chat mượt mà!
