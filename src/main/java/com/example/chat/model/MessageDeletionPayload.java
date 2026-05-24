package com.example.chat.model;

public record MessageDeletionPayload(Long id, String sender, String recipient, boolean deleted) {
    public MessageDeletionPayload(Long id, String sender, String recipient) {
        this(id, sender, recipient, true);
    }
}
