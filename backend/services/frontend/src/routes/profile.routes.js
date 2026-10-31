import { getPeople, getProfileById, getProfileByIdPicture, getProfileByIdCover, updateProfile, putProfileInterests } from "../controllers/profile.controller.js";
import { educationBody, experienceBody } from "../validators/profile.validators.js";
import { registerTimelineRoutes } from "./timeline.routes.js";
import { upload } from "@uddeepto/common";
export function registerProfileRoutes(router) {
  router.get("/people", getPeople);
  router.get("/profile/:id", getProfileById);
  router.get("/profile/:id/picture", getProfileByIdPicture);
  router.get("/profile/:id/cover", getProfileByIdCover);
  router.patch("/profile", upload.fields([{
    name: "picture",
    maxCount: 1
  }, {
    name: "cover_image",
    maxCount: 1
  }]), updateProfile);
  router.put('/profile/interests', putProfileInterests);
  registerTimelineRoutes(router, "education", "user_education", educationBody, ["institution", "degree", "field_of_study", "start_date", "end_date", "grade", "description"], "education");
  registerTimelineRoutes(router, "experience", "user_experiences", experienceBody, ["title", "workplace", "category_id", "location", "start_date", "end_date", "description"], "experience");
}
