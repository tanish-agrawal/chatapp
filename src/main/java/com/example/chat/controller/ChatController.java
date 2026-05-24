package com.example.chat.controller;

import com.example.chat.model.ChatMessage;
import com.example.chat.repository.ChatMessageRepository;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.http.ResponseEntity;
import com.example.chat.model.MessageDeletionPayload;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Controller
public class ChatController {

    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessageSendingOperations messagingTemplate;

    public ChatController(ChatMessageRepository chatMessageRepository, SimpMessageSendingOperations messagingTemplate) {
        this.chatMessageRepository = chatMessageRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload ChatMessage chatMessage, Principal principal) {
        String sender = (principal != null) ? principal.getName() : chatMessage.getSender();
        chatMessage.setSender(sender);
        chatMessage.setTimestamp(LocalDateTime.now());

        // Save to DB
        ChatMessage saved = chatMessageRepository.save(chatMessage);

        // Check if it's a private message
        if (saved.getRecipient() != null && !saved.getRecipient().trim().isEmpty()) {
            // Deliver to recipient's private queue
            messagingTemplate.convertAndSendToUser(saved.getRecipient(), "/queue/private", saved);
            // Deliver to sender's private queue (to sync multiple sessions for the sender)
            messagingTemplate.convertAndSendToUser(sender, "/queue/private", saved);
        } else {
            // Broadcast to all public lobby subscribers
            messagingTemplate.convertAndSend("/topic/public", saved);
        }
    }

    @DeleteMapping("/api/chat/messages/{id}")
    @ResponseBody
    public ResponseEntity<?> deleteMessage(@PathVariable Long id, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        return chatMessageRepository.findById(id).map(message -> {
            if (!message.getSender().equals(principal.getName())) {
                return ResponseEntity.status(403).body("You can only delete your own messages");
            }

            // Hard delete from database
            chatMessageRepository.delete(message);

            // Broadcast the deletion payload
            MessageDeletionPayload deletionPayload = new MessageDeletionPayload(id, message.getSender(), message.getRecipient());
            if (message.getRecipient() != null && !message.getRecipient().trim().isEmpty()) {
                messagingTemplate.convertAndSendToUser(message.getRecipient(), "/queue/private", deletionPayload);
                messagingTemplate.convertAndSendToUser(message.getSender(), "/queue/private", deletionPayload);
            } else {
                messagingTemplate.convertAndSend("/topic/public", deletionPayload);
            }

            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/api/chat/history")
    @ResponseBody
    public List<ChatMessage> getChatHistory(
            @RequestParam(value = "recipient", required = false) String recipient,
            Principal principal
    ) {
        List<ChatMessage> history;
        
        if (recipient != null && !recipient.trim().isEmpty() && principal != null) {
            // Load 1-on-1 private history (limit to top 50 in memory for simplicity)
            List<ChatMessage> privateList = chatMessageRepository.findPrivateHistory(principal.getName(), recipient);
            // limit to top 50
            history = new ArrayList<>(privateList.stream().limit(50).toList());
        } else {
            // Load public history
            history = new ArrayList<>(chatMessageRepository.findTop50ByRecipientIsNullOrderByTimestampDesc());
        }
        
        // Reverse to return chronological order (oldest first)
        Collections.reverse(history);
        return history;
    }
}
