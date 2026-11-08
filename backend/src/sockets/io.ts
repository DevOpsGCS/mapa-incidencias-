import type { Server } from "socket.io";

let io: Server | null = null;

export function setIo(server: Server): void {
  io = server;
}

/** Cada socket se une a `user:<username normalizado>` al conectar. */
export function userRoom(username: string): string {
  return `user:${username.trim().toLowerCase()}`;
}

/**
 * Corta los sockets de un usuario para que reconecten y se re-suscriban con
 * sus permisos actuales (las rooms se fijan al conectar). No-op sin io (tests).
 */
export function disconnectUserSockets(username: string): void {
  io?.in(userRoom(username)).disconnectSockets(true);
}
