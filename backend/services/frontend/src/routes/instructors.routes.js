import { getInstructorsByIdImage, getInstructorsById } from "../controllers/instructors.controller.js";
export function registerInstructorsRoutes(router) {
  router.get("/instructors/:id/image", getInstructorsByIdImage);
  router.get("/instructors/:id", getInstructorsById);
}
