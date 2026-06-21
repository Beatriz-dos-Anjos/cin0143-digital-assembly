
import crypto from "crypto";
import { SECURITY_CONFIG } from "../domain/types";

export class TokenService {
  generateSecureToken(): string {
    return crypto.randomBytes(SECURITY_CONFIG.TOKEN_LENGTH).toString("hex");
  }
}

export const tokenService = new TokenService();


