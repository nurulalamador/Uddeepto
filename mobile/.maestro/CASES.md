# Android Maestro case catalog

259 authored scenarios. No device execution or pass result is recorded.

| ID | Area | Scenario | Status |
| --- | --- | --- | --- |
| M001 | auth | [Login shows the required controls](flows/auth/login-form.yaml) | Not executed |
| M002 | auth | [Empty login is rejected locally](flows/auth/empty-login.yaml) | Not executed |
| M003 | auth | [Login requires a password](flows/auth/missing-password.yaml) | Not executed |
| M004 | auth | [Password visibility can be toggled both ways](flows/auth/password-toggle.yaml) | Not executed |
| M005 | auth | [Wrong password cannot open the workspace](flows/auth/invalid-password.yaml) | Not executed |
| M006 | auth | [Suspended account cannot sign in](flows/auth/suspended-user.yaml) | Not executed |
| M007 | auth | [Admin is told to use the web version](flows/auth/admin-web-only.yaml) | Not executed |
| M008 | auth | [Learner can sign in by email](flows/auth/login-email.yaml) | Not executed |
| M009 | auth | [Registration requires a full name](flows/auth/register-validation-name.yaml) | Not executed |
| M010 | auth | [Registration rejects an invalid email](flows/auth/register-validation-email.yaml) | Not executed |
| M011 | auth | [Registration rejects an invalid username](flows/auth/register-validation-username.yaml) | Not executed |
| M012 | auth | [Registration rejects a short password](flows/auth/register-validation-password.yaml) | Not executed |
| M013 | auth | [New learner reaches the correct first screen](flows/auth/register-learner.yaml) | Not executed |
| M014 | auth | [New hirer reaches the correct first screen](flows/auth/register-hirer.yaml) | Not executed |
| M015 | navigation | [Learner has learning tabs and can navigate them](flows/navigation/learner-tabs.yaml) | Not executed |
| M016 | navigation | [Hirer has hiring tabs and no learner tabs](flows/navigation/hirer-tabs.yaml) | Not executed |
| M017 | navigation | [Session survives an app restart](flows/navigation/session-restart.yaml) | Not executed |
| M018 | navigation | [Signed-out users cannot open a private job link](flows/navigation/signed-out-link.yaml) | Not executed |
| M019 | navigation | [Sign out removes access after restart](flows/navigation/logout.yaml) | Not executed |
| M020 | search | [Search requires at least two letters](flows/search/minimum-query.yaml) | Not executed |
| M021 | search | [Unknown search explains the empty result](flows/search/empty-results.yaml) | Not executed |
| M022 | search | [Search opens the requested hirer profile](flows/search/open-person.yaml) | Not executed |
| M023 | profile | [Own hirer profile shows active jobs and opens details](flows/profile/hirer-own-active-jobs.yaml) | Not executed |
| M024 | profile | [Other hirer profile shows active jobs and opens details](flows/profile/hirer-other-active-jobs.yaml) | Not executed |
| M025 | profile | [A future deadline keeps the hirer job active](flows/profile/hirer-future-deadline.yaml) | Not executed |
| M026 | profile | [Own empty hirer profile explains missing jobs](flows/profile/own-empty-hirer.yaml) | Not executed |
| M027 | profile | [Other empty hirer profile shows its empty state](flows/profile/other-empty-hirer.yaml) | Not executed |
| M028 | profile | [A profile ID can be copied](flows/profile/copy-id.yaml) | Not executed |
| M029 | profile | [Edited headline persists after reopening the profile](flows/profile/edit-headline.yaml) | Not executed |
| M030 | profile | [Profile rejects an empty name](flows/profile/invalid-name.yaml) | Not executed |
| M031 | profile | [Interest search filters the list](flows/profile/interests-filter.yaml) | Not executed |
| M032 | profile | [A learner with no interests can complete onboarding](flows/profile/newbie-onboarding.yaml) | Not executed |
| M033 | profile | [Education form requires an institution](flows/profile/education-validation.yaml) | Not executed |
| M034 | profile | [Experience form requires a title and workplace](flows/profile/experience-validation.yaml) | Not executed |
| M035 | showcase | [Post composer requires an interest](flows/showcase/required-interest.yaml) | Not executed |
| M036 | showcase | [Post composer requires content](flows/showcase/required-content.yaml) | Not executed |
| M037 | showcase | [Text post appears in the feed after publishing](flows/showcase/publish-text.yaml) | Not executed |
| M038 | showcase | [Photo upload publishes and survives opening the post](flows/showcase/publish-picture.yaml) | Not executed |
| M039 | showcase | [Selected picture can be removed before publishing](flows/showcase/remove-attachment.yaml) | Not executed |
| M040 | showcase | [Appreciation can be added and removed](flows/showcase/appreciation.yaml) | Not executed |
| M041 | showcase | [Submitted comment persists after opening the post again](flows/showcase/comment.yaml) | Not executed |
| M042 | showcase | [Cancelling post deletion keeps the post](flows/showcase/delete-cancel.yaml) | Not executed |
| M043 | showcase | [A report cannot be sent without a reason](flows/showcase/report-reason.yaml) | Not executed |
| M044 | learning | [Free course preview opens without enrollment](flows/learning/course-preview.yaml) | Not executed |
| M045 | learning | [Free course enrollment unlocks materials and records progress](flows/learning/course-enroll-progress.yaml) | Not executed |
| M046 | learning | [Free contest can be joined and entry form opens](flows/learning/contest-join.yaml) | Not executed |
| M047 | learning | [Contest leaderboard opens separately from details](flows/learning/contest-leaderboard.yaml) | Not executed |
| M048 | learning | [Webinar registration persists after reopening](flows/learning/webinar-reserve.yaml) | Not executed |
| M049 | learning | [Full webinar does not offer a reservation](flows/learning/webinar-full.yaml) | Not executed |
| M050 | learning | [Past webinar offers its recording and no reservation](flows/learning/webinar-past.yaml) | Not executed |
| M051 | jobs | [Learner can open job details from the jobs list](flows/jobs/job-details.yaml) | Not executed |
| M052 | jobs | [Closed job cannot accept an application](flows/jobs/closed-job.yaml) | Not executed |
| M053 | jobs | [Application requires a cover letter](flows/jobs/application-validation.yaml) | Not executed |
| M054 | jobs | [Learner applies using the saved CV](flows/jobs/apply-saved-cv.yaml) | Not executed |
| M055 | jobs | [Hirer job form requires a title and description](flows/jobs/post-validation.yaml) | Not executed |
| M056 | jobs | [Job salary maximum cannot be below the minimum](flows/jobs/salary-validation.yaml) | Not executed |
| M057 | jobs | [Hirer creates a remote job that is saved as a draft](flows/jobs/create-job.yaml) | Not executed |
| M058 | jobs | [Hirer can close and reopen an owned job](flows/jobs/close-reopen.yaml) | Not executed |
| M059 | jobs | [Hirer sees the seeded applicant and cover letter](flows/jobs/applicants.yaml) | Not executed |
| M060 | messages | [New conversation search requires two letters](flows/messages/people-minimum.yaml) | Not executed |
| M061 | messages | [Unknown person gives an empty result](flows/messages/people-not-found.yaml) | Not executed |
| M062 | messages | [Person search opens the correct conversation](flows/messages/start-conversation.yaml) | Not executed |
| M063 | messages | [A direct message is saved and reloads in the conversation](flows/messages/send-persist.yaml) | Not executed |
| M064 | messages | [Open community membership unlocks its channels](flows/messages/community-join.yaml) | Not executed |
| M065 | messages | [Private community requires approval before channel access](flows/messages/community-request.yaml) | Not executed |
| M066 | messages | [A member sends a community channel message](flows/messages/community-send.yaml) | Not executed |
| M067 | notifications | [Notification category limits the visible records](flows/notifications/category-filter.yaml) | Not executed |
| M068 | notifications | [A notification opens its linked job](flows/notifications/open-target.yaml) | Not executed |
| M069 | notifications | [Mark all read empties the unread list](flows/notifications/mark-read.yaml) | Not executed |
| M070 | settings | [Changing password rejects fewer than eight characters](flows/settings/short-password.yaml) | Not executed |
| M071 | settings | [Changing password rejects mismatched confirmation](flows/settings/password-mismatch.yaml) | Not executed |
| M072 | settings | [Account deletion requires password confirmation](flows/settings/delete-requires-password.yaml) | Not executed |
| M073 | settings | [Cancelling account deletion preserves the session](flows/settings/delete-cancel.yaml) | Not executed |
| M074 | settings | [A disposable account can be permanently deleted](flows/settings/delete-account.yaml) | Not executed |
| M075 | cv-ai | [CV template can be selected without sharing a file](flows/cv-ai/cv-template.yaml) | Not executed |
| M076 | cv-ai | [AI fails clearly when the isolated server has no key](flows/cv-ai/ai-unconfigured.yaml) | Not executed |
| M077 | profile | [A hirer with only closed jobs has no active posts](flows/profile/exclude-closed-jobs.yaml) | Not executed |
| M078 | profile | [A hirer with only draft jobs has no active posts](flows/profile/exclude-draft-jobs.yaml) | Not executed |
| M079 | profile | [A hirer with only expired jobs has no active posts](flows/profile/exclude-expired-jobs.yaml) | Not executed |
| M080 | messages | [Connected socket delivers an incoming message before the polling interval](flows/messages/live-receive.yaml) | Not executed |
| M081 | settings | [Password change signs out sessions and accepts only the new password](flows/settings/change-password.yaml) | Not executed |
| M082 | cv-ai | [Generated PDF is saved as the current CV and persists](flows/cv-ai/save-cv.yaml) | Not executed |
| M083 | learning | [Contest participant can submit a code entry](flows/learning/contest-submit.yaml) | Not executed |
| M084 | jobs | [Hirer changes applicant status and it persists](flows/jobs/applicant-status.yaml) | Not executed |
| M085 | auth | [Unknown username cannot create a session](flows/auth/unknown-user.yaml) | Not executed |
| M086 | auth | [Surrounding whitespace is removed from the login identifier](flows/auth/trim-identifier.yaml) | Not executed |
| M087 | auth | [Registration refuses an existing email](flows/auth/duplicate-email.yaml) | Not executed |
| M088 | auth | [Registration refuses an existing username](flows/auth/duplicate-username.yaml) | Not executed |
| M089 | auth | [Signup role selection can be changed without losing form data](flows/auth/role-toggle.yaml) | Not executed |
| M090 | auth | [Sign in link returns from registration to login](flows/auth/return-to-login.yaml) | Not executed |
| M091 | auth | [Signup password visibility can be toggled](flows/auth/signup-password-toggle.yaml) | Not executed |
| M092 | navigation | [Hirer cannot open the restricted course route](flows/navigation/guard-hirer-course.yaml) | Not executed |
| M093 | navigation | [Hirer cannot open the restricted cv route](flows/navigation/guard-hirer-cv.yaml) | Not executed |
| M094 | navigation | [Learner cannot open the restricted job-post route](flows/navigation/guard-learner-job-post.yaml) | Not executed |
| M095 | navigation | [Cancelling sign out keeps the current account signed in](flows/navigation/logout-cancel.yaml) | Not executed |
| M096 | navigation | [Android back returns from a job to the jobs tab](flows/navigation/back-to-tab.yaml) | Not executed |
| M097 | search | [Search result opens the correct course detail](flows/search/open-course.yaml) | Not executed |
| M098 | search | [Search result opens the correct job detail](flows/search/open-job.yaml) | Not executed |
| M099 | search | [Search result opens the correct contest detail](flows/search/open-contest.yaml) | Not executed |
| M100 | search | [Search result opens the correct webinar detail](flows/search/open-webinar.yaml) | Not executed |
| M101 | search | [Clearing a query returns search to its initial state](flows/search/clear-query.yaml) | Not executed |
| M102 | search | [Hirer search does not expose learner course results](flows/search/hirer-restricted-results.yaml) | Not executed |
| M103 | profile | [Profile name bio phone and address persist after saving](flows/profile/save-details.yaml) | Not executed |
| M104 | profile | [Leaving profile edit without saving preserves the stored name](flows/profile/discard-edit.yaml) | Not executed |
| M105 | profile | [Learner profile does not show hirer controls or job section](flows/profile/learner-no-job-section.yaml) | Not executed |
| M106 | profile | [Another user profile has messaging but no account editing actions](flows/profile/other-profile-actions.yaml) | Not executed |
| M107 | profile | [Added interests remain selected after saving and reopening](flows/profile/interests-persist.yaml) | Not executed |
| M108 | profile | [Removing the last interest disables saving](flows/profile/last-interest-required.yaml) | Not executed |
| M109 | profile | [Interest AI help can return to the unchanged selected list](flows/profile/interests-ai-back.yaml) | Not executed |
| M110 | profile | [Profile picture uploads and displays the server image](flows/profile/upload-picture.yaml) | Not executed |
| M111 | profile | [Profile picture can be removed after upload](flows/profile/remove-picture.yaml) | Not executed |
| M112 | profile | [Profile cover uploads and displays the server image](flows/profile/upload-cover.yaml) | Not executed |
| M113 | profile | [Profile cover can be removed after upload](flows/profile/remove-cover.yaml) | Not executed |
| M114 | profile | [Cancelling the photo picker does not mark a profile picture as selected](flows/profile/cancel-picture-picker.yaml) | Not executed |
| M115 | education | [New account education list has a useful empty state](flows/education/empty-list.yaml) | Not executed |
| M116 | education | [education requires a start month](flows/education/start-required.yaml) | Not executed |
| M117 | education | [education requires an end date unless current](flows/education/end-required.yaml) | Not executed |
| M118 | education | [education rejects a future start date](flows/education/future-start.yaml) | Not executed |
| M119 | education | [education rejects an end date before the start date](flows/education/end-before-start.yaml) | Not executed |
| M120 | education | [Unsaved education entry can be discarded](flows/education/cancel-add.yaml) | Not executed |
| M121 | education | [Current education entry is saved and can be reopened](flows/education/create-current.yaml) | Not executed |
| M122 | education | [Existing education entry changes persist](flows/education/edit-existing.yaml) | Not executed |
| M123 | education | [Cancelling education deletion keeps the record](flows/education/delete-cancel.yaml) | Not executed |
| M124 | education | [Deleting education removes it from the server-backed list](flows/education/delete-existing.yaml) | Not executed |
| M125 | experience | [New account experience list has a useful empty state](flows/experience/empty-list.yaml) | Not executed |
| M126 | experience | [experience requires a start month](flows/experience/start-required.yaml) | Not executed |
| M127 | experience | [experience requires an end date unless current](flows/experience/end-required.yaml) | Not executed |
| M128 | experience | [experience rejects a future start date](flows/experience/future-start.yaml) | Not executed |
| M129 | experience | [experience rejects an end date before the start date](flows/experience/end-before-start.yaml) | Not executed |
| M130 | experience | [Unsaved experience entry can be discarded](flows/experience/cancel-add.yaml) | Not executed |
| M131 | experience | [Current experience entry is saved and can be reopened](flows/experience/create-current.yaml) | Not executed |
| M132 | experience | [Existing experience entry changes persist](flows/experience/edit-existing.yaml) | Not executed |
| M133 | experience | [Cancelling experience deletion keeps the record](flows/experience/delete-cancel.yaml) | Not executed |
| M134 | experience | [Deleting experience removes it from the server-backed list](flows/experience/delete-existing.yaml) | Not executed |
| M135 | experience | [Experience requires a category or Others](flows/experience/category-required.yaml) | Not executed |
| M136 | experience | [Experience can be saved under Others](flows/experience/others-category.yaml) | Not executed |
| M137 | showcase | [Post search shows a useful empty state](flows/showcase/empty-search.yaml) | Not executed |
| M138 | showcase | [An interest filter excludes posts from other interests](flows/showcase/category-filter.yaml) | Not executed |
| M139 | showcase | [Leaving an unsent composer does not create a post](flows/showcase/discard-composer.yaml) | Not executed |
| M140 | showcase | [Own post offers delete and hides report](flows/showcase/own-menu.yaml) | Not executed |
| M141 | showcase | [Another person post offers report and hides delete](flows/showcase/other-menu.yaml) | Not executed |
| M142 | showcase | [Deleting an owned post removes it and reopening shows an error](flows/showcase/delete-post.yaml) | Not executed |
| M143 | showcase | [A valid report reaches the moderators](flows/showcase/report-post.yaml) | Not executed |
| M144 | showcase | [Reporting the same post twice is refused](flows/showcase/duplicate-report.yaml) | Not executed |
| M145 | showcase | [Post appreciation survives reopening the post](flows/showcase/appreciation-persist.yaml) | Not executed |
| M146 | showcase | [Whitespace-only comments cannot be submitted](flows/showcase/comment-whitespace.yaml) | Not executed |
| M147 | showcase | [Comment appreciation toggles and persists](flows/showcase/comment-appreciation.yaml) | Not executed |
| M148 | showcase | [Post pagination reaches records beyond the first page](flows/showcase/pagination.yaml) | Not executed |
| M149 | showcase | [video attachment uploads through the native picker](flows/showcase/publish-video.yaml) | Not executed |
| M150 | showcase | [audio attachment uploads through the native picker](flows/showcase/publish-audio.yaml) | Not executed |
| M151 | learning | [Course search explains that no course matches](flows/learning/course-search-empty.yaml) | Not executed |
| M152 | learning | [Course interest filter excludes unrelated courses](flows/learning/course-interest-filter.yaml) | Not executed |
| M153 | learning | [New learner has an empty enrolled course list](flows/learning/my-courses-empty.yaml) | Not executed |
| M154 | learning | [An enrolled course appears in My courses](flows/learning/my-courses-enrolled.yaml) | Not executed |
| M155 | learning | [Course catalog pagination loads a second page](flows/learning/course-pagination.yaml) | Not executed |
| M156 | learning | [Paid course cannot enroll without payment](flows/learning/premium-payment.yaml) | Not executed |
| M157 | learning | [Unenrolled learner cannot open a locked material by deep link](flows/learning/locked-material.yaml) | Not executed |
| M158 | learning | [Course instructor opens and lists published courses](flows/learning/instructor-details.yaml) | Not executed |
| M159 | learning | [Previous returns from the second material to the first](flows/learning/material-previous.yaml) | Not executed |
| M160 | events | [Events contests upcoming filter opens the matching event](flows/events/contest-upcoming.yaml) | Not executed |
| M161 | events | [Events contests previous filter opens the matching event](flows/events/contest-previous.yaml) | Not executed |
| M162 | events | [Events webinars upcoming filter opens the matching event](flows/events/webinar-upcoming.yaml) | Not executed |
| M163 | events | [Events webinars previous filter opens the matching event](flows/events/webinar-previous.yaml) | Not executed |
| M164 | events | [Contest search shows an empty list](flows/events/contest-search-empty.yaml) | Not executed |
| M165 | events | [Contest entry tab requires membership](flows/events/unjoined-entry.yaml) | Not executed |
| M166 | events | [Past contest does not accept a new join](flows/events/past-contest.yaml) | Not executed |
| M167 | events | [Contest membership persists after reopening](flows/events/joined-persist.yaml) | Not executed |
| M168 | events | [Contest submission remains disabled for whitespace code](flows/events/empty-code.yaml) | Not executed |
| M169 | events | [Webinar speaker opens the instructor profile](flows/events/webinar-speaker.yaml) | Not executed |
| M170 | events | [Upcoming registered webinar hides its meeting URL until opening time](flows/events/registered-link-hidden.yaml) | Not executed |
| M171 | jobs | [Job posting requires an interest category](flows/jobs/interest-required.yaml) | Not executed |
| M172 | jobs | [On-site job requires a location](flows/jobs/location-required.yaml) | Not executed |
| M173 | jobs | [Remote mode hides location and switching back restores it](flows/jobs/remote-toggle.yaml) | Not executed |
| M174 | jobs | [November deadline picker does not offer day 31](flows/jobs/deadline-november.yaml) | Not executed |
| M175 | jobs | [Job type filter removes permanent roles from contract results](flows/jobs/type-filter.yaml) | Not executed |
| M176 | jobs | [New learner has no applications](flows/jobs/empty-applications.yaml) | Not executed |
| M177 | jobs | [Application without a current CV requires a PDF](flows/jobs/application-cv-required.yaml) | Not executed |
| M178 | jobs | [Application can attach a PDF through the native picker](flows/jobs/application-pdf-upload.yaml) | Not executed |
| M179 | jobs | [Existing application cannot be submitted a second time](flows/jobs/already-applied.yaml) | Not executed |
| M180 | jobs | [Saved application appears in My applications](flows/jobs/applied-list.yaml) | Not executed |
| M181 | jobs | [Hirer cannot apply to or manage another hirer job](flows/jobs/nonowner-hirer.yaml) | Not executed |
| M182 | jobs | [Expired open job cannot accept new applications](flows/jobs/expired-application.yaml) | Not executed |
| M183 | jobs | [Jobs list loads records after the first page](flows/jobs/pagination.yaml) | Not executed |
| M184 | jobs | [Hirer with no applications sees the empty state](flows/jobs/hirer-empty-applicants.yaml) | Not executed |
| M185 | jobs | [Hirer can mark an applicant accepted](flows/jobs/applicant-accepted.yaml) | Not executed |
| M186 | jobs | [Hirer can mark an applicant rejected](flows/jobs/applicant-rejected.yaml) | Not executed |
| M187 | jobs | [Applicant Profile action opens the applicant account](flows/jobs/applicant-profile.yaml) | Not executed |
| M188 | jobs | [Applicant Message action opens a direct conversation](flows/jobs/applicant-message.yaml) | Not executed |
| M189 | messages | [New account has an empty inbox](flows/messages/empty-inbox.yaml) | Not executed |
| M190 | messages | [Hirer inbox does not show a community tab](flows/messages/hirer-no-community.yaml) | Not executed |
| M191 | messages | [Cancelling person search returns to the inbox](flows/messages/cancel-new.yaml) | Not executed |
| M192 | messages | [Whitespace-only direct messages cannot be sent](flows/messages/whitespace-send.yaml) | Not executed |
| M193 | messages | [Nonmember cannot open a private conversation by ID](flows/messages/conversation-access.yaml) | Not executed |
| M194 | messages | [Nonmember cannot read a protected community channel](flows/messages/community-nonmember.yaml) | Not executed |
| M195 | messages | [Cancelling community leave keeps channel access](flows/messages/leave-cancel.yaml) | Not executed |
| M196 | messages | [Leaving a community removes membership and channel access](flows/messages/leave-community.yaml) | Not executed |
| M197 | messages | [Pending private membership survives reopening](flows/messages/private-request-persist.yaml) | Not executed |
| M198 | messages | [Profile Send message opens a direct chat](flows/messages/profile-message.yaml) | Not executed |
| M199 | messages | [Socket reconnects after a full app restart](flows/messages/reconnect.yaml) | Not executed |
| M200 | notifications | [Social notification filter displays post interactions](flows/notifications/social-filter.yaml) | Not executed |
| M201 | notifications | [An unused notification category shows an empty state](flows/notifications/empty-category.yaml) | Not executed |
| M202 | notifications | [Post notification opens the correct post detail](flows/notifications/linked-post.yaml) | Not executed |
| M203 | settings | [Password change is disabled while a required field is empty](flows/settings/change-disabled.yaml) | Not executed |
| M204 | settings | [Wrong current password is rejected without signing out](flows/settings/wrong-current-password.yaml) | Not executed |
| M205 | settings | [Password change requires a different new password](flows/settings/same-password.yaml) | Not executed |
| M206 | settings | [Incorrect deletion password preserves the account](flows/settings/wrong-delete-password.yaml) | Not executed |
| M207 | cv-ai | [CV starts with the signed-in profile name](flows/cv-ai/cv-initial-values.yaml) | Not executed |
| M208 | cv-ai | [CV cannot be previewed or saved without a name](flows/cv-ai/cv-name-required.yaml) | Not executed |
| M209 | cv-ai | [CV preview opens and closes without saving](flows/cv-ai/cv-preview.yaml) | Not executed |
| M210 | cv-ai | [modern template is saved and restored with the CV](flows/cv-ai/save-modern.yaml) | Not executed |
| M211 | cv-ai | [minimal template is saved and restored with the CV](flows/cv-ai/save-minimal.yaml) | Not executed |
| M212 | cv-ai | [executive template is saved and restored with the CV](flows/cv-ai/save-executive.yaml) | Not executed |
| M213 | cv-ai | [creative template is saved and restored with the CV](flows/cv-ai/save-creative.yaml) | Not executed |
| M214 | cv-ai | [CV accent colour is persisted](flows/cv-ai/cv-accent.yaml) | Not executed |
| M215 | cv-ai | [CV skills and languages survive saving](flows/cv-ai/cv-skills.yaml) | Not executed |
| M216 | cv-ai | [A project persists in the saved CV](flows/cv-ai/cv-project.yaml) | Not executed |
| M217 | cv-ai | [CV project order persists after moving an entry up](flows/cv-ai/cv-reorder-projects.yaml) | Not executed |
| M218 | cv-ai | [CV row can be removed before saving](flows/cv-ai/cv-delete-row.yaml) | Not executed |
| M219 | cv-ai | [Cancelling CV reset preserves unsaved edits](flows/cv-ai/cv-reset-cancel.yaml) | Not executed |
| M220 | cv-ai | [Confirmed CV reset restores profile values](flows/cv-ai/cv-reset-confirm.yaml) | Not executed |
| M221 | cv-ai | [Native PDF upload becomes the current CV](flows/cv-ai/cv-upload.yaml) | Not executed |
| M222 | cv-ai | [A file named PDF with invalid content is refused](flows/cv-ai/cv-reject-fake.yaml) | Not executed |
| M223 | cv-ai | [Cancelling current CV removal preserves it](flows/cv-ai/cv-remove-cancel.yaml) | Not executed |
| M224 | cv-ai | [Current CV removal persists after reopening](flows/cv-ai/cv-remove.yaml) | Not executed |
| M225 | cv-ai | [Cancelling PDF selection keeps the saved CV unchanged](flows/cv-ai/cv-upload-cancel.yaml) | Not executed |
| M226 | cv-ai | [AI send is disabled for empty or whitespace input](flows/cv-ai/ai-whitespace.yaml) | Not executed |
| M227 | cv-ai | [Custom AI prompt shows a clear error without losing the question](flows/cv-ai/ai-custom-error.yaml) | Not executed |
| M228 | leaderboard | [Learner can open the complete leaderboard from dashboard](flows/leaderboard/learner-full.yaml) | Not executed |
| M229 | leaderboard | [Leaderboard entry opens the learner profile](flows/leaderboard/open-profile.yaml) | Not executed |
| M230 | leaderboard | [Leaderboard filters learners by interest](flows/leaderboard/interest-filter.yaml) | Not executed |
| M231 | video | [Video pauses at the first checkpoint with unanswered questions](flows/video/first-checkpoint.yaml) | Not executed |
| M232 | video | [Android back cannot bypass an unanswered video checkpoint](flows/video/cannot-dismiss.yaml) | Not executed |
| M233 | video | [Video quiz waits until all questions are answered](flows/video/partial-answers.yaml) | Not executed |
| M234 | video | [Wrong video answers require rewatching instead of continuing](flows/video/failed-quiz.yaml) | Not executed |
| M235 | video | [Rewatching a failed part reopens its checkpoint with no answers](flows/video/retry-quiz.yaml) | Not executed |
| M236 | video | [Two correct answers out of three pass the video checkpoint](flows/video/two-thirds-pass.yaml) | Not executed |
| M237 | video | [Passing a checkpoint allows playback until the next check](flows/video/next-checkpoint.yaml) | Not executed |
| M238 | video | [Saved checkpoint passes are respected when reopening a lesson](flows/video/resume-checkpoint.yaml) | Not executed |
| M239 | video | [Passing the final video check completes the lesson](flows/video/final-completion.yaml) | Not executed |
| M240 | video | [Completed video replays without checkpoint gates](flows/video/completed-replay.yaml) | Not executed |
| M241 | video | [Unenrolled learner cannot open a private video lesson](flows/video/enrollment-access.yaml) | Not executed |
| M242 | permissions | [Account navigation works when optional permissions are denied](flows/permissions/deny-optional.yaml) | Not executed |
| M243 | permissions | [System photo selection works without broad storage access](flows/permissions/photo-without-storage.yaml) | Not executed |
| M244 | errors | [Missing job has a retry action instead of a broken detail screen](flows/errors/missing-job.yaml) | Not executed |
| M245 | errors | [Missing course has a retry action instead of a broken detail screen](flows/errors/missing-course.yaml) | Not executed |
| M246 | errors | [Missing post has a retry action instead of a broken detail screen](flows/errors/missing-post.yaml) | Not executed |
| M247 | errors | [Missing profile has a retry action instead of a broken detail screen](flows/errors/missing-profile.yaml) | Not executed |
| M248 | network | [Course list recovers after a temporary server failure](flows/network/course-retry.yaml) | Not executed |
| M249 | network | [A dropped connection shows retry and recovers without signing out](flows/network/disconnected-retry.yaml) | Not executed |
| M250 | network | [A 401 renews the session and retries the original profile request](flows/network/renew-session.yaml) | Not executed |
| M251 | network | [Rejected refresh returns the account to the sign-in screen](flows/network/refresh-rejected.yaml) | Not executed |
| M252 | network | [Failed profile save keeps edits and allows retry](flows/network/profile-save-retry.yaml) | Not executed |
| M253 | network | [Failed message send retains the draft and permits retry](flows/network/message-send-retry.yaml) | Not executed |
| M254 | network | [Failed CV save preserves the draft and succeeds after retry](flows/network/cv-save-retry.yaml) | Not executed |
| M255 | network | [503 upload failure preserves the attached picture and post draft](flows/network/photo-upload-503.yaml) | Not executed |
| M256 | network | [413 upload failure preserves the attached picture and post draft](flows/network/photo-upload-413.yaml) | Not executed |
| M257 | network | [Failed application preserves the letter and current CV for retry](flows/network/application-retry.yaml) | Not executed |
| M258 | network | [Temporary registration failure preserves fields and allows retry](flows/network/registration-retry.yaml) | Not executed |
| M259 | network | [Quiz fetch failure can be retried without skipping the checkpoint](flows/network/quiz-retry.yaml) | Not executed |
