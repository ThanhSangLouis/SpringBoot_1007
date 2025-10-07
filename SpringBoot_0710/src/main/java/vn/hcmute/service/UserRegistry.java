package vn.hcmute.service;

import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * In-memory registry quản lý người dùng đang online qua WebSocket.
 * Hỗ trợ nhiều kết nối (nhiều tab) cho cùng một username bằng cách đếm số kết nối.
 */
@Component("onlineUserRegistry")
public class UserRegistry {
    private final ConcurrentHashMap<String, Integer> counters = new ConcurrentHashMap<>();

    public void add(String username) {
        if (username != null && !username.isBlank()) {
            final String key = username.trim();
            counters.merge(key, 1, Integer::sum);
        }
    }

    public void remove(String username) {
        if (username != null) {
            counters.computeIfPresent(username, (k, v) -> (v != null && v > 1) ? (v - 1) : null);
        }
    }

    public Set<String> all() {
        // Trả về bản sao bất biến để tránh sửa từ bên ngoài
        return counters.keySet().stream().collect(Collectors.toUnmodifiableSet());
    }

    public boolean exists(String username) {
        return counters.containsKey(username);
    }
}