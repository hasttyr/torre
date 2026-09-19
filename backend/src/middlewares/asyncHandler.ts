import type { NextFunction, Request, Response } from "express";

/**
 * Wraps an async Express handler so a thrown/rejected error is forwarded to
 * `next` automatically, instead of every controller repeating its own
 * try/catch/next(error) block.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
