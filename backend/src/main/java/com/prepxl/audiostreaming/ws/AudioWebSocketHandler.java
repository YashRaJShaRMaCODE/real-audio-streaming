package com.prepxl.audiostreaming.ws;

import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.IOException;

public class AudioWebSocketHandler extends BinaryWebSocketHandler {

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message)
            throws IOException {

        // Echo audio back (for testing)
        session.sendMessage(message);
    }
}
