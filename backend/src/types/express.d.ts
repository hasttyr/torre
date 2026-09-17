export interface AuthUser {
  id: string;
  rol: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
