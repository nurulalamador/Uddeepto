import { ApiError } from "@uddeepto/common";
export const admin = req => {
  if (req.user.role !== "admin") throw new ApiError(403, "Admin required");
};
export const learner = req => {
  if (req.user.role === "hirer") throw new ApiError(403, "Learner permission required");
};
export const hirerOnly = req => {
  if (req.user.role !== "hirer") throw new ApiError(403, "Hiring account required");
};
export const learnerOnly = req => {
  if (req.user.role !== "learner") throw new ApiError(403, "The AI assistant is available to learners");
};
export const cvOnly = req => {
  if (req.user.role !== "learner") throw new ApiError(403, "CVs are available to learners");
};
