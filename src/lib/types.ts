import type { User, TextChannel, NewsChannel, ThreadChannel } from 'discord.js';

export interface FightRoomOptions {
  roomCode: string;
  participants: User[];
  creator: User;
}

export type ThreadableChannel = TextChannel | NewsChannel;

export interface PurgeProgress {
  totalChannels: number;
  channelsScanned: number;
  currentChannelName: string;
  messagesDeleted: number;
}

export interface CreateThreadResult {
  success: boolean;
  thread?: ThreadChannel;
  error?: string;
}
