package vn.hcmute.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import vn.hcmute.model.ChatMessage;
import vn.hcmute.service.UserRegistry;

import java.time.LocalDateTime;

/**
 * Chat Controller
 * 
 * Xử lý các message WebSocket cho hệ thống chat
 * - Nhận và gửi tin nhắn real-time
 * - Quản lý user join/leave events
 * - Broadcast messages đến tất cả users hoặc specific user
 */
@Controller
@Slf4j
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRegistry userRegistry;

    public ChatController(SimpMessagingTemplate messagingTemplate, UserRegistry userRegistry) {
        this.messagingTemplate = messagingTemplate;
        this.userRegistry = userRegistry;
    }

    /**
     * Endpoint để serve trang chat chính
     */
    @GetMapping("/")
    public String index() {
        return "chat";
    }

    /**
     * Xử lý tin nhắn chat từ client
     * 
     * @MessageMapping: định nghĩa endpoint để nhận message từ client (/app/chat.sendMessage)
     * @SendTo: broadcast message đến tất cả subscribers của /topic/public
     */
    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        log.info("Received message from {}: {}", chatMessage.getSender(), chatMessage.getContent());
        
        // Set timestamp cho message
        chatMessage.setTimestamp(LocalDateTime.now());
        chatMessage.setType(ChatMessage.MessageType.CHAT);
        
        return chatMessage;
    }

    /**
     * Xử lý khi user tham gia chat
     * 
     * Lưu username vào WebSocket session và broadcast thông báo join
     */
    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage,
                              SimpMessageHeaderAccessor headerAccessor) {
        
        // Lưu username vào WebSocket session
    headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
    userRegistry.add(chatMessage.getSender());
        
        log.info("User {} joined the chat", chatMessage.getSender());
        
        // Tạo thông báo join
        chatMessage.setType(ChatMessage.MessageType.JOIN);
        chatMessage.setContent(chatMessage.getSender() + " đã tham gia cuộc trò chuyện!");
        chatMessage.setTimestamp(LocalDateTime.now());
        
        // Broadcast danh sách user hiện tại
        messagingTemplate.convertAndSend("/topic/users", userRegistry.all());
        return chatMessage;
    }

    /**
     * Gửi tin nhắn private đến một user cụ thể
     * Sử dụng cho chat 1-1 giữa customer và support agent
     */
    @MessageMapping("/chat.sendPrivateMessage")
    public void sendPrivateMessage(@Payload ChatMessage chatMessage) {
        log.info("Sending private message from {} to {}: {}", 
                chatMessage.getSender(), chatMessage.getReceiver(), chatMessage.getContent());
        
        chatMessage.setTimestamp(LocalDateTime.now());
        chatMessage.setType(ChatMessage.MessageType.CHAT);
        
    // Gửi tin nhắn đến đích riêng của user theo convention (không phụ thuộc Principal)
    messagingTemplate.convertAndSend(
        "/queue/private." + chatMessage.getReceiver(),
        chatMessage
    );
    }

    /**
     * API endpoint để lấy thông tin về chat system
     */
    @GetMapping("/chat/info")
    public String getChatInfo() {
        return "WebSocket Chat Support System is running!";
    }

    /**
     * API để lấy danh sách user đang online (dùng khi UI load lần đầu)
     */
    @GetMapping("/chat/users")
    public java.util.Set<String> getUsers() {
        return userRegistry.all();
    }
}