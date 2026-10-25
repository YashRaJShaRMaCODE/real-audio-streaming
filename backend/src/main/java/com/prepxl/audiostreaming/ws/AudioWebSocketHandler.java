package com.prepxl.audiostreaming.ws;

import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class AudioWebSocketHandler extends BinaryWebSocketHandler {
    private static final int MAX_AUDIO_MESSAGE_BYTES = 32 * 1024;
    private static final int MAX_FRAMES_PER_SECOND = 30;
    private final Map<String, FrameWindow> frameWindows = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        frameWindows.put(session.getId(), new FrameWindow());
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message)
            throws IOException {
        if (message.getPayloadLength() > MAX_AUDIO_MESSAGE_BYTES) {
            session.close(CloseStatus.TOO_BIG_TO_PROCESS);
            return;
        }

        FrameWindow window = frameWindows.get(session.getId());
        if (window == null || !window.allow(System.nanoTime())) {
            session.close(new CloseStatus(1008, "Audio frame rate exceeded"));
            return;
        }

        // Echo audio back (for testing)
        session.sendMessage(message);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        frameWindows.remove(session.getId());
    }

    static final class FrameWindow {
        private static final long WINDOW_NANOS = 1_000_000_000L;
        private long startedAt = System.nanoTime();
        private int frames;

        synchronized boolean allow(long now) {
            if (now - startedAt >= WINDOW_NANOS) {
                startedAt = now;
                frames = 0;
            }
            return ++frames <= MAX_FRAMES_PER_SECOND;
        }
    }
}
