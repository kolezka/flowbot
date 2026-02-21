import { Middleware, NextFunction } from "grammy";
import type { Context } from "../context";
import { toUserDataUpsertDTO } from "../../adapters/toUserDataUpsertDTO";
import { userRepository } from "../../repositories/UserRepository";


export function userDataMiddleware(): Middleware<Context> {
  return async (ctx, next) => {
    if (ctx.from) {
      try {
        const userDataUpsertDTO = toUserDataUpsertDTO(ctx);
        const userData = await userRepository.upsert(userDataUpsertDTO);
        ctx.session.userData = userData
        ctx.logger.debug({
          msg: 'User data upserted successfully',
          userData,
        })
        
      } catch (e) {
        ctx.logger.error({
          msg: 'Failed to upsert user data',
          err: e,
        })
      }
    }
    return next();
  };
}
