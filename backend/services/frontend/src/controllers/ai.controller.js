import { learnerOnly } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { askGemini } from "../services/ai.service.js";
import { aiSystemPrompt } from "../services/shared.service.js";
import { aiBody } from "../validators/shared.validators.js";
import { ApiError, query } from "@uddeepto/common";
export const createAiChat = run(async req => {
  learnerOnly(req);
  const {
    messages
  } = aiBody.parse(req.body);
  return askGemini(req.user.sub, {
    system: aiSystemPrompt,
    messages
  });
});
export const createAiInterests = run(async req => {
  if (!['learner', 'hirer'].includes(req.user.role)) throw new ApiError(403, 'The interest guide is available to learners and hirers');
  const {
    messages
  } = aiBody.parse(req.body);
  const interests = (await query('SELECT name,description FROM interest_categories WHERE is_active=true ORDER BY name')).rows;
  const list = interests.map(item => item.description ? item.name + ' (' + item.description.slice(0, 80) + ')' : item.name).join('; ');
  const system = aiSystemPrompt + '\n\nYou are helping a new ' + req.user.role + ' choose the interests for their Uddeepto profile. Interests decide which courses, contests, webinars and communities are recommended.\nThe interests that exist on the platform are exactly: ' + list + '.\n- Ask one or two short questions about their goals, hobbies or job if that helps.\n- Recommend 1 to 4 interests, using ONLY the exact names from the list above, written in **bold**. Never invent an interest that is not in the list.\n- Explain each pick in one short sentence. Keep replies under 120 words unless asked for more.\n- Remind them they can change their interests later from their profile.';
  return askGemini(req.user.sub, {
    system,
    messages
  });
});
