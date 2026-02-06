import { chatService } from "./chat.service";

export const chatController = {
  sendAgentMessage: chatService.sendAgentMessage,
  assignSession: chatService.assignSession,
  addTag: chatService.addTag
};
