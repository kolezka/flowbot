import type { Context } from "../context";

export function isBanned(ctx: Context) {

  ctx.logger.debug({
    msg: "isBanned filterd",
    userId: ctx.from?.id,
  });

  if (ctx.session.userData) {
    return !!ctx.session.userData.isBanned;
  }

  ctx.logger.warn({
    msg: "User data is not loaded in session",
    userId: ctx.from?.id,
  });

  return false;
}
