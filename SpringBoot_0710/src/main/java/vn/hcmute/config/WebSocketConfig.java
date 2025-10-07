package vn.hcmute.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket Configuration Class
 * 
 * Cấu hình WebSocket để hỗ trợ giao tiếp real-time
 * - Kích hoạt STOMP (Simple Text Oriented Messaging Protocol)
 * - Cấu hình message broker để định tuyến tin nhắn
 * - Thiết lập endpoint cho WebSocket connection
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * Cấu hình message broker
     * - /topic: cho broadcast messages (nhiều người nhận)
     * - /queue: cho point-to-point messages (1-1 messaging)
     * - /app: prefix cho các message được gửi đến server
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Kích hoạt simple broker để xử lý subscription với prefix /topic và /queue
        config.enableSimpleBroker("/topic", "/queue");
        
        // Prefix cho các message gửi từ client đến server
        config.setApplicationDestinationPrefixes("/app");
        
        // Prefix cho user-specific destinations
        config.setUserDestinationPrefix("/user");
    }

    /**
     * Đăng ký STOMP endpoints
     * - /ws: endpoint chính cho WebSocket connection
     * - withSockJS(): fallback cho các browser không hỗ trợ WebSocket
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Đăng ký endpoint /ws và enable SockJS fallback
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // Cho phép CORS từ mọi origin (dev only)
                .withSockJS(); // Enable SockJS fallback
    }
}