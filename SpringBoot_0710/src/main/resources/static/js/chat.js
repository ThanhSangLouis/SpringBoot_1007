/**
 * WebSocket Chat Client
 *
 * Quản lý kết nối WebSocket và xử lý giao tiếp real-time
 * Sử dụng SockJS và STOMP để kết nối với Spring Boot WebSocket server
 */

"use strict";

// DOM Elements
const usernameForm = document.querySelector("#usernameForm");
const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#message");
const messageArea = document.querySelector("#messageArea");
const connectingElement = document.querySelector(".connecting");
const connectionStatus = document.querySelector("#connectionStatus");
const chatPage = document.querySelector("#chatPage");
const usernameFormContainer = document.querySelector("#usernamePage");
const currentUserElement = document.querySelector("#currentUser");
const leaveButton = document.querySelector("#leaveChat");
const usersPanel = document.querySelector("#usersPanel");
const usersList = document.querySelector("#usersList");

// Global Variables
let stompClient = null;
let username = null;
let userRole = null;
let isConnected = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
let currentReceiver = null; // for private messages
let privateSubscription = null;

// Color palette for different users
const colors = [
  "#2196F3",
  "#32c787",
  "#00BCD4",
  "#ff5652",
  "#ffc107",
  "#ff85af",
  "#FF9800",
  "#39bbb0",
];

/**
 * Kết nối đến WebSocket server
 */
function connect(event) {
  event.preventDefault();

  username = document.querySelector("#name").value.trim();
  userRole = document.querySelector("#userRole").value;

  if (username && userRole) {
    // Hiện trang chat và ẩn form username
    usernameFormContainer.classList.add("hidden");
    chatPage.style.display = "flex";

    // Cập nhật UI
    currentUserElement.textContent = username;
    updateConnectionStatus("Đang kết nối...", "connecting");

    // Tạo WebSocket connection
    const socket = new SockJS("/ws");
    stompClient = Stomp.over(socket);

    // Disable console logging
    stompClient.debug = null;

    // Kết nối đến server
    stompClient.connect({}, onConnected, onError);

    // Attach low-level socket handlers for robustness
    socket.onclose = () => {
      console.warn("SockJS connection closed");
      scheduleReconnect();
    };
  }
}

/**
 * Xử lý khi kết nối thành công
 */
function onConnected() {
  isConnected = true;
  updateConnectionStatus("Đã kết nối", "connected");
  reconnectAttempts = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Subscribe đến public topic để nhận messages
  stompClient.subscribe("/topic/public", onMessageReceived);

  // Subscribe private channel theo convention cho chính mình
  privateSubscription = stompClient.subscribe(
    `/queue/private.${username}`,
    onPrivateMessageReceived
  );

  // Subscribe danh sách user online
  stompClient.subscribe("/topic/users", onUsersUpdate);

  // Load danh sách user hiện tại từ REST khi mới vào
  fetch("/chat/users")
    .then((r) => r.json())
    .then((data) => onUsersUpdate({ body: JSON.stringify(data) }))
    .catch(() => {});

  // Thông báo user tham gia
  stompClient.send(
    "/app/chat.addUser",
    {},
    JSON.stringify({
      sender: username,
      type: "JOIN",
    })
  );

  console.log("Connected to WebSocket server");

  // Heartbeat (client side noop) to keep connection alive in some proxies
  if (stompClient && stompClient.heartbeat) {
    stompClient.heartbeat.outgoing = 20000; // 20s
    stompClient.heartbeat.incoming = 0; // disabled, server default ok
  }
}

/**
 * Xử lý lỗi kết nối
 */
function onError(error) {
  isConnected = false;
  updateConnectionStatus("Kết nối thất bại. Vui lòng thử lại!", "disconnected");
  console.error("WebSocket connection error:", error);
  scheduleReconnect();
}

/**
 * Gửi tin nhắn
 */
function sendMessage(event) {
  event.preventDefault();

  const messageContent = messageInput.value.trim();

  if (messageContent && stompClient && isConnected) {
    // Hỗ trợ cú pháp gửi riêng: @username: nội dung
    const privateMatch = messageContent.match(/^@([^:]+):\s*(.*)$/);
    if (privateMatch && privateMatch[1] && privateMatch[2]) {
      const receiver = privateMatch[1].trim();
      const content = privateMatch[2].trim();
      const msg = {
        sender: username,
        receiver,
        content: sanitize(content),
        type: "CHAT",
      };
      stompClient.send("/app/chat.sendPrivateMessage", {}, JSON.stringify(msg));
    } else if (currentReceiver) {
      // Nếu đã chọn người nhận từ panel thì mặc định gửi riêng
      const msg = {
        sender: username,
        receiver: currentReceiver,
        content: sanitize(messageContent),
        type: "CHAT",
      };
      stompClient.send("/app/chat.sendPrivateMessage", {}, JSON.stringify(msg));
    } else {
      const chatMessage = {
        sender: username,
        content: sanitize(messageContent),
        type: "CHAT",
      };
      stompClient.send(
        "/app/chat.sendMessage",
        {},
        JSON.stringify(chatMessage)
      );
    }

    // Clear input
    messageInput.value = "";
  }
}

/**
 * Xử lý tin nhắn nhận được từ public topic
 */
function onMessageReceived(payload) {
  const message = JSON.parse(payload.body);

  const messageElement = document.createElement("li");

  if (message.type === "JOIN") {
    messageElement.classList.add("event-message", "join-message");
    messageElement.innerHTML = createEventMessage(message);
  } else if (message.type === "LEAVE") {
    messageElement.classList.add("event-message", "leave-message");
    messageElement.innerHTML = createEventMessage(message);
  } else {
    messageElement.classList.add("chat-message");

    // Thêm class 'own' nếu là tin nhắn của user hiện tại
    if (message.sender === username) {
      messageElement.classList.add("own");
    }

    messageElement.innerHTML = createChatMessage(message);
  }

  messageArea.appendChild(messageElement);
  scrollToBottom();
}

/**
 * Xử lý tin nhắn riêng tư
 */
function onPrivateMessageReceived(payload) {
  const message = JSON.parse(payload.body);

  const messageElement = document.createElement("li");
  messageElement.classList.add("chat-message", "private-message");
  messageElement.innerHTML = createPrivateChatMessage(message);

  messageArea.appendChild(messageElement);
  scrollToBottom();
}

/**
 * Tạo HTML cho tin nhắn chat
 */
function createChatMessage(message) {
  const time = new Date(message.timestamp || Date.now()).toLocaleTimeString(
    "vi-VN"
  );
  const avatarColor = getAvatarColor(message.sender || "?");

  return `
        <div class="message-avatar" style="background-color: ${avatarColor}">
            ${message.sender.charAt(0).toUpperCase()}
        </div>
        <div class="message-content-wrapper">
      <div class="message-sender">${escapeHtml(
        message.sender || "Ẩn danh"
      )}</div>
      <div class="message-content">${escapeHtml(message.content || "")}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
}

/**
 * Tạo HTML cho tin nhắn riêng tư
 */
function createPrivateChatMessage(message) {
  const time = new Date(message.timestamp || Date.now()).toLocaleTimeString(
    "vi-VN"
  );

  return `
        <div class="private-indicator">🔒 Tin nhắn riêng</div>
        <div class="message-sender">${escapeHtml(
          message.sender || "Ẩn danh"
        )}</div>
        <div class="message-content">${escapeHtml(message.content || "")}</div>
        <div class="message-time">${time}</div>
    `;
}

/**
 * Tạo HTML cho tin nhắn sự kiện (join/leave)
 */
function createEventMessage(message) {
  const time = new Date(message.timestamp || Date.now()).toLocaleTimeString(
    "vi-VN"
  );

  return `
        <div class="event-content">${escapeHtml(message.content || "")}</div>
        <div class="message-time">${time}</div>
    `;
}

/**
 * Lấy màu avatar cho user
 */
function getAvatarColor(messageSender) {
  let hash = 0;
  for (let i = 0; i < messageSender.length; i++) {
    hash = 31 * hash + messageSender.charCodeAt(i);
  }
  const index = Math.abs(hash % colors.length);
  return colors[index];
}

/**
 * Scroll xuống cuối danh sách tin nhắn
 */
function scrollToBottom() {
  messageArea.scrollTop = messageArea.scrollHeight;
}

/**
 * Cập nhật trạng thái kết nối
 */
function updateConnectionStatus(message, status) {
  connectionStatus.className = `connection-status ${status}`;
  connectingElement.textContent = message;
}

/**
 * Render/update danh sách user online
 */
function onUsersUpdate(payload) {
  try {
    const users = JSON.parse(payload.body);
    if (!Array.isArray(users) && !(users instanceof Set)) return;
    const arr = Array.isArray(users) ? users : Array.from(users);
    // Hiện panel khi có ít nhất 1 người
    usersPanel.style.display = arr.length ? "flex" : "none";
    usersList.innerHTML = "";
    arr
      .filter((u) => u && u !== username)
      .forEach((u) => {
        const li = document.createElement("li");
        const color = getAvatarColor(u);
        li.innerHTML = `
          <span class="user-avatar" style="background:${color}">${escapeHtml(
          u.charAt(0).toUpperCase()
        )}</span>
          <span class="user-name">${escapeHtml(u)}</span>
        `;
        li.addEventListener("click", () => {
          currentReceiver = u;
          // Hint người dùng đang gửi riêng tới ai
          messageInput.placeholder = `Nhập tin nhắn tới ${u} (riêng)...`;
        });
        usersList.appendChild(li);
      });
    if (!usersList.children.length) {
      currentReceiver = null;
      messageInput.placeholder = "Nhập tin nhắn...";
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Ngắt kết nối và quay về trang username
 */
function disconnect() {
  if (stompClient !== null && isConnected) {
    stompClient.disconnect(() => {
      console.log("Disconnected from WebSocket server");
    });
  }

  // Reset UI
  isConnected = false;
  username = null;
  userRole = null;
  messageArea.innerHTML = "";

  chatPage.style.display = "none";
  usernameFormContainer.classList.remove("hidden");

  updateConnectionStatus("Đã ngắt kết nối", "disconnected");
}

/**
 * Xử lý khi window được đóng
 */
window.addEventListener("beforeunload", function () {
  if (isConnected) {
    disconnect();
  }
});

/**
 * Event Listeners
 */
document.addEventListener("DOMContentLoaded", function () {
  // Username form submit
  usernameForm.addEventListener("submit", connect, true);

  // Message form submit
  messageForm.addEventListener("submit", sendMessage, true);

  // Leave chat button
  leaveButton.addEventListener("click", disconnect, true);

  // Enter key để gửi tin nhắn
  messageInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(event);
    }
  });

  console.log("Chat application initialized");
});

/**
 * Additional Features
 */

// Auto-focus message input khi trang chat được hiển thị
function focusMessageInput() {
  if (chatPage.style.display !== "none") {
    messageInput.focus();
  }
}

// Gửi tin nhắn typing indicator (feature mở rộng)
let typingTimer;
const typingDelay = 1000;

messageInput.addEventListener("input", function () {
  clearTimeout(typingTimer);
  // Có thể implement typing indicator ở đây

  typingTimer = setTimeout(function () {
    // User đã ngừng typing
  }, typingDelay);
});

// Hiển thị thông báo khi có tin nhắn mới (khi tab không active)
let isTabActive = true;
let unreadCount = 0;

document.addEventListener("visibilitychange", function () {
  isTabActive = !document.hidden;
  if (isTabActive) {
    unreadCount = 0;
    document.title = "Hệ thống Chat Hỗ trợ Khách hàng";
  }
});

// Cập nhật title khi có tin nhắn mới
function updatePageTitle() {
  if (!isTabActive) {
    unreadCount++;
    document.title = `(${unreadCount}) Tin nhắn mới - Chat Hỗ trợ`;
  }
}

// Override onMessageReceived để thêm notification
const originalOnMessageReceived = onMessageReceived;
onMessageReceived = function (payload) {
  originalOnMessageReceived(payload);
  updatePageTitle();
};

/** Security helpers to prevent XSS */
function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitize(text) {
  // For this demo, escapers are enough; in a real app consider stricter sanitization
  return text.trim();
}

/** Auto-reconnect with exponential backoff */
function scheduleReconnect() {
  if (isConnected) return;
  const maxDelay = 15000; // 15s
  const delay = Math.min(maxDelay, 1000 * Math.pow(2, reconnectAttempts));
  reconnectAttempts = Math.min(reconnectAttempts + 1, 10);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (!isConnected) {
      console.info("Attempting to reconnect...", {
        attempt: reconnectAttempts,
      });
      // Try to reconnect using the existing username/role if available
      if (username && userRole) {
        // Simulate submit without toggling UI again
        const socket = new SockJS("/ws");
        stompClient = Stomp.over(socket);
        stompClient.debug = null;
        stompClient.connect({}, onConnected, onError);
        socket.onclose = () => {
          console.warn("SockJS connection closed (reconnect)");
          scheduleReconnect();
        };
      }
    }
  }, delay);
}
