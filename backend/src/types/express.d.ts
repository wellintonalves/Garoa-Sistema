import { UsuarioJWT } from './index';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioJWT;
    }
  }
}
