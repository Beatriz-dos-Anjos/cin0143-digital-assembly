import { Server, Socket } from "socket.io";
import { z } from "zod";
import {
  scoreChannel,
  SOCKET_EVENTS,
  SESSION_DURATION_SEC,
} from "../domain/types";
import withSessionLock from "../domain/lock.service";
import { processVote, getTokenStatus, getEligibleTokens } from "../domain/vote-validator";
import {
  buildVoteContext,
  logConnection,
  logDisconnection,
  logDuplicateVote,
  logInvalidFormat,
  logUnauthorizedVote,
  logVoteAccepted,
  logVoteSummary,
  logClientAuthenticated,
  logTokenGenerated,
} from "../handlers/vote-handler";
import { logger } from "../loggers/logger";
import { sessionStore } from "../repository/session-store";
import { tokenService } from "../token/token-service";

const socketTokens = new Map<string, string>();

const ClientRegisterSchema = z.object({
  token: z.string().optional(),
});

export function registerSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    const session = sessionStore.getDefault();

    socket.join(session.session_id);
    logConnection(socket.id, session.session_id);

    socket.emit(SOCKET_EVENTS.CONNECTION_ACK, {
      message: "Connected to the voting server.",
      session_id: session.session_id,
      current_score: session.current_score,
      started_at: session.started_at,
      duration_seconds: SESSION_DURATION_SEC,
    });

    socket.on(SOCKET_EVENTS.CLIENT_REGISTER, (payload: unknown) => {
      try {
        const validated = ClientRegisterSchema.parse(
          typeof payload === "object" ? payload : {}
        );

        const requestedToken = validated.token?.trim() || tokenService.generateSecureToken();
        const updatedSession = sessionStore.addAuthorizedToken(session.session_id, requestedToken);

        if (!updatedSession) {
          socket.emit(SOCKET_EVENTS.VOTE_ERROR, {
            code: "SESSION_NOT_FOUND",
            message: "Default session not found",
          });
          return;
        }
        socketTokens.set(socket.id, requestedToken);

        logClientAuthenticated(
          requestedToken,
          updatedSession.session_id,
          socket.id,
          updatedSession.authorized_tokens.length
        );

        socket.emit(SOCKET_EVENTS.CLIENT_REGISTERED, {
          token: requestedToken,
          session_id: updatedSession.session_id,
        });
      } catch (error) {
        socket.emit(SOCKET_EVENTS.VOTE_ERROR, {
          code: "INVALID_FORMAT",
          message: "Error registering client",
        });
      }
    });

    socket.on(SOCKET_EVENTS.SESSION_REQUEST, () => {
      const currentSession = sessionStore.getDefault();
      const eligibleTokens = getEligibleTokens(currentSession);

      logger.info("WEBSOCKET", "Session snapshot requested", {
        session_id: currentSession.session_id,
        socket_id: socket.id,
        eligible_tokens: eligibleTokens.length,
      });

      socket.emit(SOCKET_EVENTS.SESSION_DATA, {
        session_id: currentSession.session_id,
        current_score: currentSession.current_score,
        authorized_tokens: eligibleTokens,
        voted_tokens: currentSession.voted_tokens,
        started_at: currentSession.started_at,
        duration_seconds: SESSION_DURATION_SEC,
      });
    });

    socket.on(SOCKET_EVENTS.CAST_VOTE, async (payload: unknown) => {
      const payloadStr = typeof payload === "string" ? payload : String(payload);
      const context = buildVoteContext(session, socket, socketTokens.get(socket.id));
      const result = await withSessionLock(session.session_id, () =>
        processVote(session, payloadStr, context)
      );

      if (!result.success) {
        if (result.error.code === "FORMATO_INVALIDO") {
          logInvalidFormat(payloadStr, context);
        } else if (result.error.code === "TOKEN_NAO_AUTORIZADO") {
          const token = payloadStr.split("|")[1] ?? "unknown";
          logUnauthorizedVote(token, context, payloadStr);
        } else if (result.error.code === "VOTO_DUPLICADO" && result.duplicate) {
          logDuplicateVote(result.duplicate, context, payloadStr);
        }

        socket.emit(SOCKET_EVENTS.VOTE_ERROR, result.error);
        return;
      }

      const channel = scoreChannel(session.session_id);
      io.to(session.session_id).emit(channel, result.score);

      socket.emit(SOCKET_EVENTS.VOTE_ACCEPTED, {
        token: result.vote.token,
        session_id: result.vote.session_id,
      });

      logVoteAccepted(result, context);
      logVoteSummary(session);
    });

    socket.on("token_status_request", (token: unknown) => {
      const tokenStr = typeof token === "string" ? token : String(token);
      const status = getTokenStatus(session, tokenStr);
      socket.emit("token_status_response", status);
    });

    socket.on("generate_token_request", () => {
      const newToken = tokenService.generateSecureToken();
      sessionStore.addAuthorizedToken(session.session_id, newToken);

      logTokenGenerated(newToken, session.session_id);

      socket.emit("generate_token_response", { token: newToken });
    });

    socket.on("list_votes_request", () => {
      socket.emit("list_votes_response", {
        votes: session.votes_cast,
      });
    });

    socket.on("disconnect", () => {
      socketTokens.delete(socket.id); 
      logDisconnection(socket.id);
    });
  });
}
